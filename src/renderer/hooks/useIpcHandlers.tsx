import { useEffect } from 'react';
import { Button, Text } from '@mantine/core';
import { ipc, remote } from '../electron';
import { useApp } from '../store/app';
import { useUi } from '../store/ui';
import { activateTabAt, activeHandle, alert } from '../actions';

const ranges = [
	{ divider: 1e18, suffix: 'P' },
	{ divider: 1e15, suffix: 'E' },
	{ divider: 1e12, suffix: 'T' },
	{ divider: 1e9, suffix: 'G' },
	{ divider: 1e6, suffix: 'M' },
	{ divider: 1e3, suffix: 'k' },
];

function shortNumber(value: string): string {
	const n = parseInt(value, 10);
	for ( const range of ranges ) if ( n >= range.divider ) return Math.round(n / range.divider).toString() + range.suffix;
	return n.toString();
}

// Taskbar overlay icon for Windows, the main process asks for it when the unread count changes
function badgeDataUrl(messageCount: string): string {
	const canvas = document.createElement('canvas');
	canvas.height = 140;
	canvas.width = 140;
	const ctx = canvas.getContext('2d')!;
	ctx.fillStyle = 'red';
	ctx.beginPath();
	ctx.ellipse(70, 70, 70, 70, 0, 0, 2 * Math.PI);
	ctx.fill();
	ctx.textAlign = 'center';
	ctx.fillStyle = 'white';

	if ( messageCount.length === 3 ) {
		ctx.font = '75px sans-serif';
		ctx.fillText(messageCount, 70, 98);
	} else if ( messageCount.length === 2 ) {
		ctx.font = '100px sans-serif';
		ctx.fillText(messageCount, 70, 105);
	} else if ( messageCount.length === 1 ) {
		ctx.font = '125px sans-serif';
		ctx.fillText(messageCount, 70, 112);
	} else {
		ctx.font = '75px sans-serif';
		ctx.fillText(shortNumber(messageCount), 70, 98);
	}
	return canvas.toDataURL();
}

// Shows a banner at the top of the window (replacing any previous update banner)
function showUpdateBanner(content: React.ReactNode) {
	useApp.getState().showBanner({ id: 'update', color: '#31B96E', content });
}

export async function askForMediaAccess() {
	await remote.systemPreferences.askForMediaAccess('microphone');
	await remote.systemPreferences.askForMediaAccess('camera');
}

// Messages from the main process (menu, tray, updater)
export function useIpcHandlers() {
	useEffect(() => {
		const handlers: Record<string, (...args: never[]) => void> = {
			showAbout: () => useUi.getState().setAboutOpen(true),
			showPreferences: () => useUi.getState().setPreferencesOpen(true),
			grantPermissions: askForMediaAccess,
			'autoUpdater:check-update': () => ipc.send('autoUpdater:check-for-updates', { manual: true }),
			'autoUpdater:update-not-available': () => alert('You are up to date!', 'You have the latest version of LibreRambox.'),
			'autoUpdater:update-available': (_e, version: string) => alert('New Version available!', 'LibreRambox ' + (version || '') + ' is available. Please wait until LibreRambox downloads the new version and asks you to install it.'),
			'autoUpdater:error': (_e, message: string) => alert('Update check failed', <><Text>Could not check for updates.</Text><Text mt="sm">{message || ''}</Text></>, 'red'),
			'autoUpdater:update-downloaded': (_e, info: { version: string }) => {
				console.log('Update downloaded!', info);
				showUpdateBanner(
					<>
						<Text size="sm"><b>New version is ready to be installed ({info.version})!</b> Click the following button to install it now.</Text>
						<Button size="xs" onClick={() => ipc.send('autoUpdater:quit-and-install')}>Install now</Button>
						<Button size="xs" variant="white" component="a" href="https://github.com/LibreRambox/LibreRambox/releases/latest" target="_blank">Changelog</Button>
					</>,
				);
			},
			// A newer release exists on GitHub but can't be installed automatically
			'autoUpdater:update-available-manual': (_e, info: { version: string; currentVersion: string; url: string }) => {
				console.log('New version available on GitHub:', info);
				showUpdateBanner(
					<>
						<Text size="sm"><b>LibreRambox {info.version} is available!</b> You are running version {info.currentVersion}.</Text>
						<Button size="xs" component="a" href={info.url} target="_blank">Download</Button>
					</>,
				);
			},
			// Set Badge in taskbar for Windows
			setBadge: (_e, messageCount: number) => {
				const count = String(messageCount);
				ipc.send('setBadge', count, badgeDataUrl(count));
			},
			reloadCurrentService: () => activeHandle()?.reload(),
			toggleStatusBar: () => activeHandle()?.toggleStatusBar(),
			'resetzoom-webview': () => activeHandle()?.resetZoom(),
			'zoomin-webview': () => activeHandle()?.zoomIn(),
			'zoomout-webview': () => activeHandle()?.zoomOut(),
			'browser-backward': () => activeHandle()?.goBack(),
			'browser-forward': () => activeHandle()?.goForward(),
			'shortcut:tab': (_e, index: number) => activateTabAt(index),
		};
		for ( const [channel, handler] of Object.entries(handlers) ) ipc.on(channel, handler as never);
		return () => {
			for ( const [channel, handler] of Object.entries(handlers) ) ipc.removeListener(channel, handler as never);
		};
	}, []);
}

