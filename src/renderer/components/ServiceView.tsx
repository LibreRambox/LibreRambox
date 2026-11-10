import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { WebviewTag } from 'electron';
import { ActionIcon, Button, Group, Text, TextInput } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconX, IconMoon, IconSun, IconCheck, IconLoader2, IconAlertTriangle } from '@tabler/icons-react';
import type { Service } from '../store/types';
import { useCatalog } from '../store/catalog';
import { useServices } from '../store/services';
import { useApp } from '../store/app';
import { ipc, remote, platform, resourceFileUrl } from '../electron';
import { format, t } from '../i18n';
import { formatNumber } from '../util/format';
import { dispatchNotification } from '../util/notifier';
import { activateTab } from '../actions';
import { partitionFor, userAgentFor } from '../util/service';
import { registry, type ServiceHandle } from '../util/registry';

// Google blocks logins from embedded browsers, these pages get reloaded once with a Firefox user agent
const GOOGLE_LOGIN_URLS = [
	'accounts.google.com/ServiceLogin',
	'accounts.google.com/signin',
	'accounts.google.com/_/lookup/accountlookup',
	'accounts.google.com/o/oauth2',
	'accounts.google.com/_/signin',
	'accounts.google.com/AddSession?',
	'accounts.google.com/_/',
];

// Error codes: https://cs.chromium.org/chromium/src/net/base/net_error_list.h
const LOAD_ERRORS: Record<number, string> = {
	[-2]: 'NET error: failed.',
	[-3]: 'An operation was aborted (due to user action)',
	[-7]: 'Connection timeout.',
	[-21]: 'Network change.',
	[-100]: 'The connection was reset. Check your internet connection.',
	[-101]: 'The connection was reset. Check your internet connection.',
	[-105]: 'Name not resolved. Check your internet connection.',
	[-106]: 'There is no active internet connection.',
	[-118]: 'Connection timed out. Check your internet connection.',
	[-130]: 'Proxy connection failed. Please, check the proxy configuration.',
	[-300]: 'The URL is invalid.',
	[-324]: 'Empty response. Check your internet connection.',
};

const minutes = (value: number, fallback: number) => Math.max(1, Math.floor(value) || fallback) * 60 * 1000;

interface StatusState {
	keep: boolean; // docked and always visible, otherwise it only floats in while loading
	closed: boolean;
	loading: boolean;
	message: { text: string; warning: boolean } | null;
	url: string;
}

interface SearchState {
	open: boolean;
	text: string;
	result: string;
}

export function ServiceView({ service, active }: { service: Service; active: boolean }) {
	const entry = useCatalog((s) => s.entries.find((e) => e.id === service.type));
	const dontDisturb = useApp((s) => s.dontDisturb);
	const locked = useApp((s) => s.locked);

	const [hibernated, setHibernatedState] = useState(false);
	// Bumped to create a new <webview> (after waking up)
	const [webviewKey, setWebviewKey] = useState(0);
	const [domReady, setDomReady] = useState(0);
	const [status, setStatus] = useState<StatusState>({ keep: service.statusbar, closed: false, loading: false, message: null, url: '' });
	const [search, setSearch] = useState<SearchState>({ open: false, text: '', result: '' });

	const containerRef = useRef<HTMLDivElement>(null);
	const searchRef = useRef<HTMLInputElement>(null);
	const webviewRef = useRef<WebviewTag | null>(null);
	// The current <webview> once it emitted dom-ready (most webview methods throw before)
	const readyWebview = useRef<WebviewTag | null>(null);

	// Latest values for event listeners and timers
	const serviceRef = useRef(service);
	serviceRef.current = service;
	const entryRef = useRef(entry);
	entryRef.current = entry;
	const activeRef = useRef(active);
	activeRef.current = active;
	const hibernatedRef = useRef(false);

	const timers = useRef<{ hibernate?: number; rewake?: number; rehibernate?: number; zoom?: number; unreadFrames?: number }>({});
	const zoomLevel = useRef(service.zoomLevel);
	const currentUnreadCount = useRef(0);
	const errorCodeLog = useRef<number[]>([]);
	const wakingUp = useRef(false);

	const setHibernated = useCallback((value: boolean) => {
		hibernatedRef.current = value;
		setHibernatedState(value);
		useApp.getState().setHibernated(serviceRef.current.id, value);
	}, []);

	const getWebView = () => (hibernatedRef.current ? null : readyWebview.current);

	/**
	 * UNREAD COUNTER
	 */
	const setUnreadCount = useCallback((newUnreadCount: number | string) => {
		const s = serviceRef.current;
		const app = useApp.getState();
		const n = parseFloat(String(newUnreadCount));
		if ( !Number.isNaN(Number(newUnreadCount)) && (n | 0) === n && s.includeInGlobalUnreadCounter ) {
			app.setUnread(s.id, parseInt(String(newUnreadCount), 10));
		} else {
			app.setUnread(s.id, null);
		}

		const badge = formatNumber(newUnreadCount);
		app.setBadge(s.id, s.displayTabUnreadCounter && badge !== '0' ? badge : '');

		// Dispatch manual notification if the service doesn't have notifications, so LibreRambox does them
		const count = parseInt(String(newUnreadCount), 10);
		if ( entryRef.current?.manual_notifications && currentUnreadCount.current < count && s.notifications && !app.dontDisturb ) {
			dispatchNotification(s, entryRef.current, count);
		}
		currentUnreadCount.current = count;
	}, []);

	const clearUnreadCounter = useCallback(() => {
		const app = useApp.getState();
		app.setBadge(serviceRef.current.id, '');
		app.setUnread(serviceRef.current.id, null);
	}, []);

	/**
	 * HIBERNATION
	 *
	 * A hibernated service has its <webview> removed (freeing the renderer process and its RAM)
	 * and replaced by a lightweight placeholder. Cookies/logins are kept in the persistent partition,
	 * so waking up just loads the service again.
	 */
	const clearHibernationTimers = useCallback(() => {
		clearTimeout(timers.current.hibernate);
		clearTimeout(timers.current.rewake);
		clearTimeout(timers.current.rehibernate);
		timers.current.hibernate = timers.current.rewake = timers.current.rehibernate = undefined;
	}, []);

	// The functions below call each other through timers; refs keep them pointing to the latest version
	const fns = useRef<{ hibernate: (force?: boolean) => void; wake: (background?: boolean) => void; scheduleHibernation: () => void; scheduleRewake: () => void }>(null!);
	fns.current = {
		// Starts (or restarts) the countdown to hibernate this service while it is in the background
		scheduleHibernation() {
			clearTimeout(timers.current.hibernate);
			timers.current.hibernate = undefined;
			const s = serviceRef.current;
			if ( !s.hibernate || hibernatedRef.current || activeRef.current ) return;
			timers.current.hibernate = window.setTimeout(() => {
				timers.current.hibernate = undefined;
				if ( !activeRef.current ) fns.current.hibernate();
			}, minutes(s.hibernateAfter, 15));
		},
		// Schedules the next background wake-up to check for new messages
		scheduleRewake() {
			clearTimeout(timers.current.rewake);
			timers.current.rewake = undefined;
			const s = serviceRef.current;
			if ( !hibernatedRef.current || !s.hibernateRewake ) return;
			timers.current.rewake = window.setTimeout(() => {
				timers.current.rewake = undefined;
				if ( hibernatedRef.current && !activeRef.current ) fns.current.wake(true);
			}, minutes(s.hibernateRewakeEvery, 15));
		},
		hibernate(force = false) {
			if ( hibernatedRef.current ) return;
			if ( activeRef.current && !force ) return;
			console.info('Hibernating service:', serviceRef.current.name);
			clearHibernationTimers();
			clearInterval(timers.current.unreadFrames);
			timers.current.unreadFrames = undefined;
			setHibernated(true); // unmounting the <webview> element frees its process; the last known unread badge is kept
			fns.current.scheduleRewake();
		},
		/**
		 * Loads the service again.
		 * @param background true for a periodic wake-up: hibernate again after "hibernateRewakeFor" minutes
		 */
		wake(background = false) {
			if ( !hibernatedRef.current ) return;
			console.info('Waking up service:', serviceRef.current.name, background ? '(background check)' : '');
			clearHibernationTimers();
			wakingUp.current = true;
			setHibernated(false);
			setWebviewKey((k) => k + 1);
			if ( background ) {
				timers.current.rehibernate = window.setTimeout(() => {
					timers.current.rehibernate = undefined;
					if ( !activeRef.current ) fns.current.hibernate();
				}, minutes(serviceRef.current.hibernateRewakeFor, 1));
			} else {
				fns.current.scheduleHibernation();
			}
		},
	};

	const reloadService = useCallback(() => {
		if ( hibernatedRef.current ) return fns.current.wake();
		const webview = readyWebview.current;
		if ( !webview ) return;
		clearUnreadCounter();
		webview.loadURL(serviceRef.current.url);
	}, [clearUnreadCounter]);

	const onFailLoad = (message: string) => {
		errorCodeLog.current = [];
		setTimeout(() => setStatus((st) => ({ ...st, message: { text: 'The service failed at loading, Error: ' + message, warning: true } })), 1000);
	};

	const setZoom = (level: number) => {
		zoomLevel.current = level;
		const webview = getWebView();
		if ( !webview ) return;
		webview.setZoomLevel(level);
		useServices.getState().update(serviceRef.current.id, { zoomLevel: level });
	};
	const zoomBy = (delta: number) => {
		clearTimeout(timers.current.zoom);
		timers.current.zoom = window.setTimeout(() => setZoom(zoomLevel.current + delta), 100);
	};

	const showSearch = (visible: boolean) => {
		const webview = getWebView();
		if ( !webview ) return;
		webview.stopFindInPage('keepSelection');
		setSearch({ open: visible, text: visible ? search.text : '', result: '' });
		if ( visible ) setTimeout(() => searchRef.current?.focus(), 100);
	};
	const doSearch = (text: string, forward = true) => {
		const webview = getWebView();
		if ( !webview ) return;
		if ( text === '' ) {
			webview.stopFindInPage('clearSelection');
			setSearch((s) => ({ ...s, text, result: '' }));
			return;
		}
		setSearch((s) => ({ ...s, text }));
		webview.findInPage(text, { forward, findNext: false, matchCase: false });
	};

	const focusWebView = () => {
		const webview = getWebView();
		if ( !webview ) return;
		webview.blur();
		webview.focus();
	};

	/**
	 * Creates the <webview>. It is built imperatively and never moved in the DOM: a reparented
	 * <webview> reloads its page, so tab reordering only changes the tab bar.
	 */
	useLayoutEffect(() => {
		if ( hibernated || !containerRef.current ) return;
		const s = serviceRef.current;
		const partition = partitionFor(s);
		const webview = document.createElement('webview') as WebviewTag;
		webview.className = 'webview';
		webview.setAttribute('src', s.url);
		webview.setAttribute('partition', partition);
		webview.setAttribute('plugins', 'true');
		webview.setAttribute('allowtransparency', 'on');
		webview.setAttribute('autosize', 'on');
		webview.setAttribute('webpreferences', 'spellcheck=no, contextIsolation=no');
		webview.setAttribute('allowpopups', 'on');
		webview.setAttribute('useragent', userAgentFor(entryRef.current));
		webview.setAttribute('preload', resourceFileUrl('js/librerambox-service-api.js'));
		webviewRef.current = webview;
		errorCodeLog.current = [];

		// Start the hibernation countdown for services loaded in the background
		if ( !wakingUp.current ) fns.current.scheduleHibernation();
		wakingUp.current = false;

		remote.session.fromPartition(partition).webRequest.onBeforeSendHeaders((details: { url: string; requestHeaders: Record<string, string> }, callback: (r: object) => void) => {
			if ( /^https:\/\/accounts\.google\.com(\/|$)/.test(details.url) ) {
				details.requestHeaders['User-Agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:160.0) Gecko/20100101 Firefox/160.0';
				for ( const h of Object.keys(details.requestHeaders) ) if ( /^sec-ch-ua/i.test(h) ) delete details.requestHeaders[h];
			}
			callback({ cancel: false, requestHeaders: details.requestHeaders });
		});

		const on = <E extends Event>(name: string, fn: (e: E) => void) => webview.addEventListener(name, fn as EventListener);

		// Show and hide spinner when is loading
		on('did-start-loading', () => {
			console.info('Start loading...', serviceRef.current.url);
			setStatus((st) => ({ ...st, loading: true, message: null }));
		});
		on('did-stop-loading', () => setStatus((st) => ({ ...st, loading: false })));

		on('did-finish-load', () => {
			// Apply saved zoom level
			webview.setZoomLevel(serviceRef.current.zoomLevel);
			// Fix cursor sometimes disappearing
			if ( activeRef.current ) focusWebView();
			// Set special icon for some services
			if ( serviceRef.current.type === 'slack' ) {
				webview.executeJavaScript('(a=>window.slackDebug.activeTeam.redux.getState().teams[a].icon.image_44)(window.slackDebug.activeTeamId);')
					.then((image: string) => { if ( image ) useApp.getState().setTabIcon(serviceRef.current.id, image); })
					.catch((err: unknown) => console.log(err));
			}
		});

		on<Electron.FoundInPageEvent>('found-in-page', (e) => {
			setSearch((st) => ({ ...st, result: e.result.activeMatchOrdinal + '/' + e.result.matches }));
		});

		on<Electron.DidFailLoadEvent>('did-fail-load', (e) => {
			console.info('The service fail at loading', serviceRef.current.url, e);
			if ( serviceRef.current.disableAutoReloadOnFail || !e.isMainFrame ) return;
			errorCodeLog.current.push(e.errorCode);
			const attempts = errorCodeLog.current.filter((code) => code === e.errorCode).length;
			switch ( e.errorCode ) {
				case 0:
					break;
				case -3: // Gmail and other pages that use iframes abort some of them, firing this error
					if ( attempts <= 4 ) return;
					setTimeout(reloadService, 200);
					errorCodeLog.current = [];
					break;
				case -2: case -7: case -21: case -118: case -324: case -100: case -101: case -105:
					attempts > 4 ? onFailLoad(LOAD_ERRORS[e.errorCode]) : setTimeout(reloadService, 2000);
					break;
				case -106:
					onFailLoad(LOAD_ERRORS[e.errorCode]);
					break;
				case -130: // Could not create a connection to the proxy server
				case -300:
					attempts > 4 ? onFailLoad(LOAD_ERRORS[e.errorCode]) : reloadService();
					break;
			}
		});

		let firstDomReady = true;
		on('dom-ready', () => {
			const svc = serviceRef.current;
			const tpl = entryRef.current;
			let jsInject = '';

			// Mute Webview
			const app = useApp.getState();
			webview.setAudioMuted(svc.muted || app.locked || app.dontDisturb);

			// Injected code to detect new messages
			const jsUnread = (tpl ? tpl.js_unread : '') + svc.js_unread;
			if ( jsUnread !== '' ) {
				console.groupCollapsed(svc.type.toUpperCase() + ' - JS Injected to Detect New Messages');
				console.log(jsUnread);
				console.groupEnd();
				jsInject += jsUnread;
			}

			// Prevent Title blinking (some services have) and only allow when the title have an unread regex match: "(3) Title"
			if ( tpl?.titleBlink ) {
				jsInject += 'var originalTitle=document.title;Object.defineProperty(document,"title",{configurable:!0,set:function(a){null===a.match(new RegExp("[(]([0-9•]+)[)][ ](.*)","g"))&&a!==originalTitle||(document.getElementsByTagName("title")[0].innerHTML=a)},get:function(){return document.getElementsByTagName("title")[0].innerHTML}});';
			}

			// Scroll always to top (bug)
			jsInject += 'document.body.scrollTop=0;';

			if ( firstDomReady ) {
				firstDomReady = false;
				const contents = remote.webContents.fromId(webview.getWebContentsId());

				// Handles Certificate Errors
				contents.on('certificate-error', (event: Event, _url: string, _error: string, _certificate: unknown, callback: (trust: boolean) => void) => {
					if ( serviceRef.current.trust ) {
						event.preventDefault();
						callback(true);
					} else {
						callback(false);
					}
					setStatus((st) => ({ ...st, keep: true, closed: false, message: { text: 'Certification Warning', warning: true } }));
				});

				// Forward shortcuts pressed inside the service to the main window
				contents.on('before-input-event', (_event: Event, input: Electron.Input) => {
					if ( input.type !== 'keyDown' ) return;
					const modifiers: string[] = [];
					if ( input.shift ) modifiers.push('shift');
					if ( input.control ) modifiers.push('control');
					if ( input.alt ) modifiers.push('alt');
					if ( input.meta ) modifiers.push('meta');
					if ( input.isAutoRepeat ) modifiers.push('isAutoRepeat');
					if ( input.key === 'Tab' && !modifiers.length ) return;

					let key = input.key;
					// Maps special keys to fire the correct event in macOS
					if ( platform === 'darwin' ) {
						const keys: Record<string, string> = { 'ƒ': 'f', ' ': 'l', '∂': 'd' }; // Search, Lock, DND
						key = keys[key] || key;
					}
					if ( key === 'F11' || key === 'a' || key === 'A' || key === 'F12' || key === 'q' || (key === 'F1' && modifiers.includes('control')) ) return;

					remote.getCurrentWebContents().sendInputEvent({ type: input.type, keyCode: key, modifiers });
				});

				if ( GOOGLE_LOGIN_URLS.some((url) => webview.getURL().includes(url)) ) webview.reload();
			}
			webview.executeJavaScript(jsInject).catch((err: unknown) => console.log(err));

			// Unread detection in subframes (opt-in per service via "js_unread_iframes").
			// Some services embed their UI in cross-origin iframes - e.g. Google Chat, when
			// chat.google.com redirects to mail.google.com/chat. Their unread indicators are
			// then unreachable from the main frame, where js_unread normally runs. The preload
			// bridge is not available in subframes either, so a shim collects the count inside
			// each matching frame and the highest count found is applied once per interval.
			if ( jsUnread !== '' && tpl?.js_unread_iframes && !timers.current.unreadFrames ) {
				const serviceHost = new URL(svc.url).host;
				const subframeScript = 'if(!window.__lrUnreadInjected){window.__lrUnreadInjected=true;' +
					'window.librerambox||(window.librerambox={_c:null' +
					',setUnreadCount:function(c){this._c=(c==="•"?999999:parseInt(c))||0}' +
					',clearUnreadCount:function(){this._c=0}});' + jsUnread + '}';
				let lastFrameCount = 0;
				timers.current.unreadFrames = window.setInterval(() => {
					if ( !webview.isConnected ) {
						clearInterval(timers.current.unreadFrames);
						timers.current.unreadFrames = undefined;
						return;
					}
					const wc = remote.webContents.fromId(webview.getWebContentsId());
					if ( !wc || wc.isDestroyed() ) return;
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const frames = wc.mainFrame.framesInSubtree.filter((frame: any) => {
						if ( frame === wc.mainFrame ) return false; // main frame runs js_unread via the preload bridge
						try { return new URL(frame.url).host === serviceHost; } catch { return false; }
					});
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					frames.forEach((frame: any) => frame.executeJavaScript(subframeScript).catch(() => {}));
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					Promise.all(frames.map((frame: any) => frame.executeJavaScript('window.librerambox?window.librerambox._c:null').catch(() => null)))
						.then((counts: unknown[]) => {
							const numbers = counts.filter((c): c is number => typeof c === 'number');
							if ( !numbers.length ) return;
							const count = Math.max(...numbers);
							// Forward zero only after a non-zero count, so unrelated same-host
							// frames that never match anything cannot clobber the actual badge.
							if ( count > 0 || lastFrameCount > 0 ) {
								lastFrameCount = count;
								setUnreadCount(count);
							}
						});
				}, 3000);
			}

			readyWebview.current = webview;
			setDomReady((n) => n + 1);
		});

		on<Electron.IpcMessageEvent>('ipc-message', (event) => {
			switch ( event.channel ) {
				case 'librerambox.setUnreadCount': {
					let count = event.args?.[0];
					if ( count === parseInt(count, 10) || count === '•' ) {
						if ( count === 999999 ) count = '•';
						setUnreadCount(count);
					}
					break;
				}
				case 'librerambox.clearUnreadCount':
					useApp.getState().setBadge(serviceRef.current.id, '');
					currentUnreadCount.current = 0;
					setUnreadCount(0);
					break;
				case 'librerambox.showWindowAndActivateTab':
					remote.getCurrentWindow().show();
					activateTab(serviceRef.current.id);
					// Temp fix missing cursor after upgrade to electron 3.x +
					focusWebView();
					break;
			}
		});

		// Services without a js_unread script get their unread count from the page title: "(3) Inbox"
		if ( entryRef.current ? entryRef.current.js_unread === '' : false ) {
			on<Electron.PageTitleUpdatedEvent>('page-title-updated', (e) => {
				const match = e.title.match(/\(([^)]+)\)/); // Get text between (...)
				const text = match ? match[1] : '0';
				// Some services have special characters. Example: (•)
				const digits = text.match(/\d+/g);
				setUnreadCount(text === '•' ? text : digits ? digits.join('') : '0');
			});
		}

		on<Electron.DidNavigateEvent>('did-navigate', (e) => {
			// Delayed because sometimes it is not redirecting. TweetDeck 2FA is an example.
			if ( serviceRef.current.type === 'tweetdeck' ) setTimeout(() => webview.loadURL(e.url), 1000);
		});

		on<Electron.UpdateTargetUrlEvent>('update-target-url', (e) => setStatus((st) => ({ ...st, url: e.url })));

		containerRef.current.prepend(webview);
		return () => {
			clearInterval(timers.current.unreadFrames);
			timers.current.unreadFrames = undefined;
			webview.remove();
			if ( webviewRef.current === webview ) webviewRef.current = null;
			if ( readyWebview.current === webview ) readyWebview.current = null;
		};
	}, [hibernated, webviewKey, reloadService, setUnreadCount]);

	// Mute and notifications follow the service settings, Don't Disturb and the lock.
	// Only a <webview> that emitted dom-ready accepts setAudioMuted.
	useEffect(() => {
		const webview = getWebView();
		if ( webview && readyWebview.current === webview ) webview.setAudioMuted(service.muted || dontDisturb || locked);
	}, [service.muted, dontDisturb, locked, domReady, hibernated]);

	useEffect(() => {
		if ( hibernated ) return;
		ipc.send('setServiceNotifications', partitionFor(service), service.notifications && !dontDisturb && !locked);
	}, [service.notifications, dontDisturb, locked, hibernated, webviewKey]);

	// URL edited in the service settings
	const loadedUrl = useRef(service.url);
	useEffect(() => {
		if ( loadedUrl.current === service.url ) return;
		loadedUrl.current = service.url;
		getWebView()?.loadURL(service.url);
	}, [service.url]);

	useEffect(() => {
		setStatus((st) => ({ ...st, keep: service.statusbar, closed: false }));
	}, [service.statusbar]);

	// Badge settings edited: show the counter again with the new settings
	const firstRender = useRef(true);
	useEffect(() => {
		if ( firstRender.current ) return;
		setUnreadCount(currentUnreadCount.current);
	}, [service.displayTabUnreadCounter, service.includeInGlobalUnreadCounter, setUnreadCount]);

	// Hibernation settings edited
	useEffect(() => {
		if ( firstRender.current ) return;
		if ( hibernatedRef.current ) {
			!service.hibernate ? fns.current.wake() : fns.current.scheduleRewake();
		} else {
			fns.current.scheduleHibernation();
		}
	}, [service.hibernate, service.hibernateAfter, service.hibernateRewake, service.hibernateRewakeEvery, service.hibernateRewakeFor]);

	// Tab activation
	useEffect(() => {
		if ( firstRender.current ) return;
		if ( active ) {
			// While the user is looking at the service it never hibernates
			clearHibernationTimers();
			if ( hibernatedRef.current && serviceRef.current.hibernateOnSelect !== 'ask' ) fns.current.wake();
			// Make focus on webview every time the user changes tabs, to enable the autofocus in websites
			const timer = setTimeout(focusWebView, 300);
			return () => clearTimeout(timer);
		}
		hibernatedRef.current ? fns.current.scheduleRewake() : fns.current.scheduleHibernation();
	}, [active, clearHibernationTimers]);

	useEffect(() => {
		firstRender.current = false;
	}, []);

	const toggleStatusBar = () => setStatus((st) => (st.closed ? { ...st, keep: serviceRef.current.statusbar, closed: false } : { ...st, closed: true, keep: serviceRef.current.statusbar }));

	// Imperative handle for menus, shortcuts and IPC
	const handle = useRef<ServiceHandle>(null!);
	handle.current = {
		reload: reloadService,
		goBack: () => getWebView()?.goBack(),
		goForward: () => getWebView()?.goForward(),
		zoomIn: () => zoomBy(0.25),
		zoomOut: () => zoomBy(-0.25),
		resetZoom: () => setZoom(0),
		showSearch,
		toggleDevTools: () => {
			const webview = getWebView();
			if ( webview ) webview.isDevToolsOpened() ? webview.closeDevTools() : webview.openDevTools();
		},
		toggleStatusBar,
		toggleHibernation: () => (hibernatedRef.current ? fns.current.wake() : fns.current.hibernate(true)),
		isHibernated: () => hibernatedRef.current,
		getWebView,
		focus: focusWebView,
	};
	useEffect(() => {
		const id = service.id;
		const proxy: ServiceHandle = new Proxy({} as ServiceHandle, { get: (_t, key: keyof ServiceHandle) => handle.current[key] });
		registry.register(id, proxy);
		return () => {
			registry.unregister(id, proxy);
			clearHibernationTimers();
			clearTimeout(timers.current.zoom);
			useApp.getState().forgetService(id);
		};
	}, [service.id, clearHibernationTimers]);

	const statusVisible = status.keep ? !status.closed : status.loading || !!status.message;

	return (
		<div className="service-view">
			{search.open && (
				<Group className="service-search" gap={6} justify="flex-end">
					<TextInput
						ref={searchRef}
						size="xs"
						placeholder="Search..."
						value={search.text}
						onChange={(e) => doSearch(e.currentTarget.value)}
						onKeyDown={(e) => {
							if ( e.key === 'Enter' ) doSearch(search.text, !e.shiftKey);
							if ( e.key === 'Escape' ) showSearch(false);
						}}
					/>
					<Text size="xs" w={50}>{search.result}</Text>
					<ActionIcon variant="default" onClick={() => doSearch(search.text, false)}><IconChevronLeft size={14} /></ActionIcon>
					<ActionIcon variant="default" onClick={() => doSearch(search.text, true)}><IconChevronRight size={14} /></ActionIcon>
					<ActionIcon variant="subtle" onClick={() => showSearch(false)}><IconX size={14} /></ActionIcon>
				</Group>
			)}
			<div className="service-webview" ref={containerRef}>
				{hibernated && (
					<div className="service-placeholder">
						<IconMoon size={48} opacity={0.6} />
						<h3>{format(t('app.hibernation[12]'), service.name)}</h3>
						<p style={{ opacity: 0.7 }}>{t('app.hibernation[13]')}</p>
						<Button leftSection={<IconSun size={16} />} onClick={() => fns.current.wake()}>{t('app.hibernation[11]')}</Button>
					</div>
				)}
			</div>
			{statusVisible && !hibernated && (
				<div className={'service-statusbar' + (status.keep ? '' : ' floating')}>
					<span className="status-text">
						{status.message ? (
							<><IconAlertTriangle size={12} /> {status.message.text}</>
						) : status.loading ? (
							<><IconLoader2 size={12} className="spin" /> {t('app.webview[4]')}</>
						) : (
							<><IconCheck size={12} /> Ready</>
						)}
					</span>
					<span className="status-url">{status.url}</span>
					{status.keep && (
						<ActionIcon size="xs" variant="subtle" color="gray" title="Close statusbar until next time" onClick={() => setStatus((st) => ({ ...st, closed: true }))}>
							<IconX size={12} />
						</ActionIcon>
					)}
				</div>
			)}
		</div>
	);
}
