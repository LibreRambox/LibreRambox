'use strict';

import { app, BrowserWindow, shell, Menu, ipcMain, nativeImage, session } from 'electron';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createHash } from 'node:crypto';
// Tray
import tray from './tray.js';
// Menu
import buildMenu from './menu.js';
// AutoLaunch
import autoLaunch from './utils/autoLaunch.js';
// Configuration
import Config from 'electron-store';
// Development
import isDev from 'electron-is-dev';
// Updater
import updater from './updater.js';
import contextMenu from 'electron-context-menu';
import remoteMain from '@electron/remote/main/index.js';
import tmp from 'tmp';
import mime from 'mime';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { positionOnScreen } = require('./utils/positionOnScreen.js');
const { migrate } = require('./utils/migrationAssistant.js');

if ( isDev ) app.getVersion = function() { return require('../package.json').version; }; // FOR DEV ONLY, BECAUSE IN DEV RETURNS ELECTRON'S VERSION

// Initial Config
const config = new Config({
	 defaults: {
		 always_on_top: false
		,hide_menu_bar: false
		,tabbar_location: 'top'
		,hide_tabbar_labels: false
		,window_display_behavior: 'taskbar_tray'
		,auto_launch: !isDev
		,flash_frame: true
		,window_close_behavior: 'keep_in_tray'
		,start_minimized: false
		,systemtray_indicator: true
		,master_password: false
		,dont_disturb: false
		,disable_gpu: process.platform === 'linux'
		,proxy: false
		,proxyHost: ''
		,proxyPort: ''
		,proxyLogin: ''
		,proxyPassword: ''
		,locale: 'en'
		,enable_hidpi_support: false
		,user_agent: ''
		,default_service: 'libreRamboxTab'
		,sendStatistics: false
		,migrated: false

		,x: undefined
		,y: undefined
		,width: 1000
		,height: 800
		,maximized: false
	}
});

// Migrate the home tab id renamed along with the app namespace
if ( config.get('default_service') === 'ramboxTab' ) config.set('default_service', 'libreRamboxTab');

// Fix issues with HiDPI scaling on Windows platform
if (config.get('enable_hidpi_support') && (process.platform === 'win32')) {
	app.commandLine.appendSwitch('high-dpi-support', 'true')
	app.commandLine.appendSwitch('force-device-scale-factor', '1')
}

app.commandLine.appendSwitch('lang', config.get('locale') === 'en' ? 'en-US' :  config.get('locale'));

// Temporary fix to load Twitter and other websites inside webviews
// Bug related with Electron: https://github.com/electron/electron/issues/25469
// Verified effective on Electron 44: the switch value is passed through
// unmodified (not lowercased) and the COOP override is honored.
app.commandLine.appendSwitch('disable-features', 'CrossOriginOpenerPolicy');

// Because we build it using Squirrel, it will assign UserModelId automatically, so we match it here to display notifications correctly.
// https://github.com/electron-userland/electron-builder/issues/362
app.setAppUserModelId('io.github.librerambox');

// Menu
const appMenu = buildMenu(config);

// Configure AutoLaunch
if ( !isDev ) config.get('auto_launch') ? autoLaunch.enable() : autoLaunch.disable();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;
let isQuitting = false;

function createWindow () {
	// Create the browser window using the state information
	mainWindow = new BrowserWindow({
		 title: 'LibreRambox'
		// macOS ignores BrowserWindow.icon (dock icon comes from the bundle);
		// passing an .ico there only triggers nativeImage decode warnings.
		,icon: process.platform === 'darwin' ? undefined : __dirname + '/../resources/Icon.' + (process.platform === 'linux' ? 'png' : 'ico')
		,backgroundColor: '#FFF'
		,x: config.get('x')
		,y: config.get('y')
		,width: config.get('width')
		,height: config.get('height')
		,alwaysOnTop: config.get('always_on_top')
		,autoHideMenuBar: config.get('hide_menu_bar')
		,skipTaskbar: config.get('window_display_behavior') === 'show_trayIcon'
		,show: !config.get('start_minimized')
		,acceptFirstMouse: true
		,webPreferences: {
			plugins: true
			// Keep the legacy partition name: it holds the main window's localStorage
			// (services, preferences). Renaming it would silently drop all settings.
			,partition: 'persist:rambox'
			,nodeIntegration: true
			,webviewTag: true
			,contextIsolation: false
			,spellcheck: false
		}
	});
	remoteMain.enable(mainWindow.webContents);

	// Check if user has defined a custom User-Agent
	if ( config.get('user_agent').length > 0 ) mainWindow.webContents.setUserAgent( config.get('user_agent') );

	// Wait for the mainWindow.loadURL(..) and the optional mainWindow.webContents.openDevTools()
	// to be finished before minimizing
	config.get('start_minimized') && mainWindow.webContents.once('did-finish-load', () => config.get('window_display_behavior') === 'show_trayIcon' ? mainWindow.hide() :  mainWindow.minimize());

	// Check if the window its outside of the view (ex: multi monitor setup)
	const inBounds = positionOnScreen([config.get('x'), config.get('y')]);
	if ( inBounds ) {
		mainWindow.setPosition(config.get('x'), config.get('y'));
	} else {
		mainWindow.center();
	}

	process.setMaxListeners(10000);

	// Open the DevTools.
	if ( isDev ) mainWindow.webContents.openDevTools();

	// and load the index.html of the app.
	mainWindow.loadURL('file://' + __dirname + '/../index.html');

	Menu.setApplicationMenu(appMenu);

	tray.create(mainWindow, config);

	updater.initialize(mainWindow);

	// Open links in default browser
	mainWindow.webContents.setWindowOpenHandler(( handlerDetails ) => {
		shell.openExternal(handlerDetails.url);
  		return { action: 'deny' };
	});

	mainWindow.webContents.on('will-navigate', function(event, url) {
		event.preventDefault();
	});

	// BrowserWindow events
	mainWindow.on('page-title-updated', (e, title) => updateBadge(title));
	mainWindow.on('maximize', function(e) { config.set('maximized', true); });
	mainWindow.on('unmaximize', function(e) { config.set('maximized', false); });
	mainWindow.on('resize', function(e) { if (!mainWindow.isMaximized()) config.set(mainWindow.getBounds()); });
	mainWindow.on('move', function(e) { if (!mainWindow.isMaximized()) config.set(mainWindow.getBounds()); });
	mainWindow.on('app-command', (e, cmd) => {
		// Navigate the window back when the user hits their mouse back button
		if ( cmd === 'browser-backward' ) mainWindow.webContents.executeJavaScript('if(Ext.cq1("app-main")) Ext.cq1("app-main").getActiveTab().goBack();');
		// Navigate the window forward when the user hits their mouse forward button
		if ( cmd === 'browser-forward' ) mainWindow.webContents.executeJavaScript('if(Ext.cq1("app-main")) Ext.cq1("app-main").getActiveTab().goForward();');
	});

	// Emitted when the window is closed.
	mainWindow.on('close', function(e) {
		if ( !isQuitting ) {
			e.preventDefault();

			switch (process.platform) {
				case 'darwin':
					app.hide();
					break;
				case 'linux':
				case 'win32':
				default:
					switch (config.get('window_close_behavior')) {
						case 'keep_in_tray':
							mainWindow.hide();
							break;
						case 'keep_in_tray_and_taskbar':
							mainWindow.minimize();
							break;
						case 'quit':
							app.quit();
							break;
					}
					break;
			}
		}
	});
	mainWindow.on('minimize', function(e) {
		if ( config.get('window_display_behavior') === 'show_trayIcon' ) mainWindow.setSkipTaskbar(true);
	});
	mainWindow.on('restore', function(e) {
		if ( config.get('window_display_behavior') === 'show_taskbar' ) mainWindow.setSkipTaskbar(false);
	});
	mainWindow.on('show', function(e) {
		if ( config.get('window_display_behavior') !== 'show_trayIcon' ) mainWindow.setSkipTaskbar(false);
	});
	mainWindow.on('closed', function(e) {
		mainWindow = null;
	});
	mainWindow.once('focus', () => mainWindow.flashFrame(false));
}

let mainMasterPasswordWindow;
function createMasterPasswordWindow() {
	mainMasterPasswordWindow = new BrowserWindow({
		 backgroundColor: '#0B2444'
		,frame: false
		,webPreferences: {
			nodeIntegration: true,
			contextIsolation: false
		}
	});
	remoteMain.enable(mainMasterPasswordWindow.webContents);

	// Open the DevTools.
	if ( isDev ) mainMasterPasswordWindow.webContents.openDevTools();

	mainMasterPasswordWindow.loadURL('file://' + __dirname + '/../masterpassword.html');
	mainMasterPasswordWindow.on('close', function() { mainMasterPasswordWindow = null });
}

function updateBadge(title) {
	title = title.split(" - ")[0]; //Discard service name if present, could also contain digits
	var messageCount = title.match(/\d+/g) ? parseInt(title.match(/\d+/g).join("")) : 0;
	messageCount = isNaN(messageCount) ? 0 : messageCount;

	tray.setBadge(messageCount, config.get('systemtray_indicator'));

	if (process.platform === 'win32') {
		if (messageCount === 0) return mainWindow.setOverlayIcon(null, '');
		mainWindow.webContents.send('setBadge', messageCount);
	} else { // macOS & Linux
		app.setBadgeCount(messageCount);
	}

	if ( messageCount > 0 && !mainWindow.isFocused() && !config.get('dont_disturb') && config.get('flash_frame') ) mainWindow.flashFrame(true);
}

// ALLOWED URLS POPUPS
const allowPopUp = [
	'feedly.com/v3/auth/',
	'identity.linuxfoundation.org/cas/login',
	'auth.missiveapp.com',
	'accounts.google.com/AccountChooser',
	'facebook.com/v3.1/dialog/oauth?',
	'accounts.google.com/o/oauth2',
	'app.slack.com/files/import/gdrive',
	'spikenow.com/s/account',
	'app.mixmax.com/_oauth/google',
	'officeapps.live.com',
	'dropbox.com/profile_services/start_auth_flow',
	'facebook.com/v3.2/dialog/oauth?',
	'notion.so/googlepopupredirect',
	'zoom.us/office365',
	'figma.com/start_google_sso',
	'mail.google.com/mail',
	'app.slack.com/free-willy/',
	'messenger.com/videocall',
	'api.moo.do',
	'manychat.com/fb?popup',
	'=?print=true' // esta ultima checkea como anda imprimir un pedf desde gmail, si no va bie sacala
];

function startApp() {
	ipcMain.on('setBadge', function(event, messageCount, value) {
		mainWindow.setOverlayIcon(nativeImage.createFromDataURL(value), messageCount.toString());
	});

	ipcMain.on('getConfig', function(event, arg) {
		event.returnValue = config.store;
	});
	ipcMain.on('sConfig', function(event, values) {
		config.set(values);
		event.returnValue = config;
	});
	ipcMain.on('setConfig', function(event, values) {
		config.set(values);

		// hide_menu_bar
		mainWindow.setAutoHideMenuBar(values.hide_menu_bar);
		if ( !values.hide_menu_bar ) mainWindow.setMenuBarVisibility(true);
		// always_on_top
		mainWindow.setAlwaysOnTop(values.always_on_top);
		// auto_launch
		if ( !isDev ) values.auto_launch ? autoLaunch.enable() : autoLaunch.disable();
		// systemtray_indicator
		updateBadge(mainWindow.getTitle());

		mainWindow.webContents.executeJavaScript('(function(a){if(a)a.controller.initialize(a)})(Ext.cq1("app-main"))');

		switch ( values.window_display_behavior ) {
			case 'show_taskbar':
				mainWindow.setSkipTaskbar(false);
				tray.destroy();
				break;
			case 'show_trayIcon':
				mainWindow.setSkipTaskbar(true);
				tray.create(mainWindow, config);
				break;
			case 'taskbar_tray':
				mainWindow.setSkipTaskbar(false);
				tray.create(mainWindow, config);
				break;
			default:
				break;
		}
	});

	ipcMain.on('sendStatistics', function(event) {
		event.returnValue = config.get('sendStatistics');
	});

	ipcMain.on('validateMasterPassword', function(event, pass) {
		if ( config.get('master_password') === createHash('md5').update(pass).digest('hex') ) {
			createWindow();
			mainMasterPasswordWindow.close();
			event.returnValue = true;
		}
		event.returnValue = false;
	});

	// Handle Service Notifications
	ipcMain.on('setServiceNotifications', function(event, partition, op) {
		if ( partition === null ) return;
		session.fromPartition(partition).setPermissionRequestHandler(function(webContents, permission, callback) {
			if (permission === 'notifications') return callback(op);
			callback(true)
		});
	});

	ipcMain.on('setDontDisturb', function(event, arg) {
		config.set('dont_disturb', arg);
	});

	// Reload app
	ipcMain.on('reloadApp', function(event) {
		mainWindow.reload();
	});

	// Relaunch app
	ipcMain.on('relaunchApp', function(event) {
		app.relaunch();
		app.exit(0);
	});

	app.on('second-instance', (event, commandLine, workingDirectory) => {
		// Someone tried to run a second instance, we should focus our window.
		if (mainWindow) {
			if (mainWindow.isMinimized()) mainWindow.restore();
			mainWindow.focus();
			mainWindow.show();
			mainWindow.setSkipTaskbar(false);
			if (app.dock && app.dock.show) app.dock.show();
		}
	});

	app.on('web-contents-created', (webContentsCreatedEvent, contents) => {
		if (contents.getType() !== 'webview') return;
		// Block some Deep links to prevent that open its app (Ex: Slack)
		contents.on('will-navigate', (event, url) => url.substring(0, 8) === 'slack://' && event.preventDefault());

		// New Window handler Electron >=22
		contents.setWindowOpenHandler(({url, frameName}) => {

			let allow = false;
			allowPopUp.forEach(allowUrl => url.indexOf(allowUrl) > -1 && (allow = true));
			if (!allow) {
				shell.openExternal(url);
			}
			else {
				// do we need to open windows internally somewhere? #shrugemoji
				// const win = new BrowserWindow();
				// win.loadURL(url);
				// return win.show();
			}
		});

		contents.on('did-create-window', (win, details) => {
			// Here we center the new window.
			win.center();
			// The following code is for handling the about:blank cases only.
			if (!['about:blank', 'about:blank#blocked'].includes(details.url)) return;
			let once = false;
			win.webContents.on('will-navigate', (e, nextURL) => {
				if (once) return;
				if (['about:blank', 'about:blank#blocked'].includes(nextURL)) return;
				once = true;
				let allow = false;
				allowPopUp.forEach(url => nextURL.indexOf(url) > -1 && (allow = true));
				// If the url is in aboutBlankOnlyWindow we handle this as a popup window
				if (allow) return win.show();
				shell.openExternal(url);
				win.close();
			});
		});
	});

	// Code for downloading images as temporal files
	// Credit: Ghetto Skype (https://github.com/stanfieldr/ghetto-skype)
	var imageCache = {};
	ipcMain.on('image:download', function(event, url, partition) {
		let file = imageCache[url];
		if (file) {
			if (file.complete) {
				shell.openPath(file.path);
			}

			// Pending downloads intentionally do not proceed
			return;
		}

		let tmpWindow = new BrowserWindow({
			 show: false
			,webPreferences: {
				partition: partition
			}
		});

		if ( config.get('user_agent').length > 0 ) tmpWindow.webContents.setUserAgent( config.get('user_agent') );

		tmpWindow.webContents.session.once('will-download', (event, downloadItem) => {
			imageCache[url] = file = {
				 path: tmp.tmpNameSync() + '.' + mime.getExtension(downloadItem.getMimeType())
				,complete: false
			};

			downloadItem.setSavePath(file.path);
			downloadItem.once('done', () => {
				tmpWindow.destroy();
				tmpWindow = null;
				shell.openPath(file.path);
				file.complete = true;
			});
		});

		tmpWindow.webContents.downloadURL(url);
	});

	// Hangouts
	ipcMain.on('image:popup', function(event, url, partition) {
		let tmpWindow = new BrowserWindow({
			 width: mainWindow.getBounds().width
			,height: mainWindow.getBounds().height
			,parent: mainWindow
			,icon: process.platform === 'darwin' ? undefined : __dirname + '/../resources/Icon.ico'
			,backgroundColor: '#FFF'
			,autoHideMenuBar: true
			,skipTaskbar: true
			,webPreferences: {
				partition: partition
			}
		});

		if ( config.get('user_agent').length > 0 ) tmpWindow.webContents.setUserAgent( config.get('user_agent') );

		tmpWindow.maximize();

		tmpWindow.loadURL(url);
	});

	ipcMain.on('toggleWin', function(event, allwaysShow) {
		if ( config.get('window_display_behavior') !== 'show_trayIcon' ) mainWindow.setSkipTaskbar(false);
		if ( !mainWindow.isMinimized() && mainWindow.isMaximized() && mainWindow.isVisible() ) { // Maximized
			!allwaysShow ? mainWindow.close() : mainWindow.show();
		} else if ( mainWindow.isMinimized() && !mainWindow.isMaximized() && mainWindow.isVisible() ) { // Minimized
			if ( process.platform === 'linux' ) {
				mainWindow.minimize();
				mainWindow.restore();
				mainWindow.focus();
				return
			}
			mainWindow.restore();
		} else if ( !mainWindow.isMinimized() && !mainWindow.isMaximized() && mainWindow.isVisible() ) { // Windowed mode
			!allwaysShow ? mainWindow.close() : mainWindow.show();
		} else if ( mainWindow.isMinimized() && !mainWindow.isMaximized() && mainWindow.isVisible() ) { // Closed to taskbar
			if ( process.platform === 'linux' ) {
				mainWindow.minimize();
				mainWindow.restore();
				mainWindow.focus();
				return
			}
			mainWindow.restore();
		} else if ( !mainWindow.isMinimized() && mainWindow.isMaximized() && !mainWindow.isVisible() ) { // Closed maximized to tray
			mainWindow.show();
		} else if ( !mainWindow.isMinimized() && !mainWindow.isMaximized() && !mainWindow.isVisible() ) { // Closed windowed to tray
			mainWindow.show();
		} else if ( mainWindow.isMinimized() && !mainWindow.isMaximized() && !mainWindow.isVisible() ) { // Closed minimized to tray
			mainWindow.show();
		} else {
			if ( process.platform === 'linux' ) {
				mainWindow.minimize();
				mainWindow.maximize();
				mainWindow.focus();
				return
			}
			mainWindow.restore();
		}
	});

	// ScreenShare
	ipcMain.on('screenShare:show', (event, screenList) => {
		let tmpWindow = new BrowserWindow({
			title: 'LibreRambox - Select screen',
			width: 600,
			height: 500,
			icon: process.platform === 'darwin' ? undefined : __dirname + '/../resources/Icon.ico',
			autoHideMenuBar: true,
			transparent: true,
			show: true,
			frame: false,
			hasShadow: true,
			webPreferences: {
				nodeIntegration: true,
				contextIsolation: false,
			},
		});

		const close = () => {
			tmpWindow.close();
			tmpWindow = null;
		};

		const onCancel = () => {
			event.sender.send('screenShare:cancel');
			close();
		};

		const onShare = (_, shareId) => {
			event.sender.send('screenShare:share', shareId);
			close();
		};

		ipcMain.handle('screenShare:getSources', () => screenList);
		ipcMain.on('screenShare:cancelSelection', onCancel);
		ipcMain.on('screenShare:selectScreen', onShare);

		tmpWindow.on('closed', () => {
			ipcMain.removeHandler('screenShare:getSources');
			ipcMain.removeAllListeners('screenShare:cancelSelection');
			ipcMain.removeAllListeners('screenShare:selectScreen');
		});

		tmpWindow.loadFile(__dirname + '/../screenselector.html');
	});


	// Proxy
	if ( config.get('proxy') ) {
		app.commandLine.appendSwitch('proxy-server', config.get('proxyHost')+':'+config.get('proxyPort'));
		app.on('login', (event, webContents, request, authInfo, callback) => {
			if(!authInfo.isProxy)
				return;

			event.preventDefault();
			callback(config.get('proxyLogin'), config.get('proxyPassword'))
		})
	}

	// Disable GPU Acceleration for Linux
	// to prevent White Page bug
	// https://github.com/electron/electron/issues/6139
	// https://github.com/saenzramiro/rambox/issues/181
	if ( config.get('disable_gpu') ) app.disableHardwareAcceleration();

	// This method will be called when Electron has finished
	// initialization and is ready to create browser windows.
	app.on('ready', function() {
		remoteMain.initialize();
		config.get('master_password') ? createMasterPasswordWindow() : createWindow();

		migrate(mainWindow, config);
	});
	// Quit when all windows are closed.
	app.on('window-all-closed', function () {
		// On OS X it is common for applications and their menu bar
		// to stay active until the user quits explicitly with Cmd + Q
		if (process.platform !== 'darwin') {
			app.quit();
		}
	});

	// Only macOS: On OS X it's common to re-create a window in the app when the
	// dock icon is clicked and there are no other windows open.
	app.on('activate', function () {
		if (mainWindow === null && mainMasterPasswordWindow === null ) {
			config.get('master_password') ? createMasterPasswordWindow() : createWindow();
		}

		if (mainWindow) {
			mainWindow.show();
		}
	});

	app.on('before-quit', function () {
		isQuitting = true;
	});

	// Prevent the ability to create webview with nodeIntegration.
	app.on('web-contents-created', (event, contents) => {
		remoteMain.enable(contents);
		const contextMenuWebContentsDispose = contextMenu({
			window: contents,
			showCopyImageAddress: true,
			showSaveImage: false,
			showSaveImageAs: true,
		});

		// Workaround for Google (gmail) accounts, they forbid Electron User-Agent so we use Firefox ESR.
		contents.session.webRequest.onBeforeSendHeaders(
			{
				urls: [
					'https://accounts.google.com/',
					'https://accounts.google.com/*'
				]
			},
			(details, callback) => {
				details.requestHeaders['User-Agent'] =
					'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36';
				callback({ requestHeaders: details.requestHeaders });
			}
		);

		contents.on('will-attach-webview', (event, webPreferences, params) => {
			// Always prevent node integration
			webPreferences.nodeIntegration = false;
		});

		contents.on('destroyed', function() {
			contextMenuWebContentsDispose();
		})
	});
}

const shouldQuit = app.requestSingleInstanceLock();
if (!shouldQuit) {
	app.quit();
} else {
	startApp();
}
