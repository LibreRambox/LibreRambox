import { Button, Text } from '@mantine/core';
import { modals } from '@mantine/modals';
import { ipc, platform, remote } from './electron';
import { getConfig, storeConfig } from './config';
import { HOME_TAB, useApp } from './store/app';
import { getService } from './store/services';
import { activateTab } from './actions';
import { askForMediaAccess } from './hooks/useIpcHandlers';

// Replaces the ESM-only `is-online` package: navigator.onLine fast-path
// plus a real HTTP probe (some networks report online without connectivity).
async function isOnline(): Promise<boolean> {
	if ( !navigator.onLine ) return false;
	try {
		const controller = new AbortController();
		setTimeout(() => controller.abort(), 5000);
		await fetch('https://www.gstatic.com/generate_204', { method: 'HEAD', mode: 'no-cors', cache: 'no-store', signal: controller.signal });
		return true;
	} catch {
		return false;
	}
}

export async function checkConnection() {
	let hideNoConnection = !!getConfig().hideNoConnectionDialog;
	if ( (await isOnline()) || hideNoConnection ) return;

	const id = modals.open({
		title: 'No Internet Connection',
		withCloseButton: false,
		closeOnClickOutside: false,
		children: (
			<>
				<Text size="sm">Please, check your internet connection. If you use a Proxy, please go to Preferences to configure it. LibreRambox will try to re-connect in 10 seconds</Text>
				<Button.Group mt="md">
					<Button onClick={() => modals.close(id)}>Ok</Button>
					<Button variant="default" onClick={() => {
						storeConfig({ hideNoConnectionDialog: true });
						hideNoConnection = true;
						modals.close(id);
					}}>Never show this again</Button>
				</Button.Group>
			</>
		),
	});
	setTimeout(() => {
		if ( !hideNoConnection ) ipc.send('reloadApp');
	}, 10000);
}

export function checkMacPermissions() {
	if ( localStorage.getItem('hideMacPermissions') || platform !== 'darwin' ) return;
	const status = (type: string) => remote.systemPreferences.getMediaAccessStatus(type);
	if ( status('microphone') === 'granted' && status('camera') === 'granted' ) return;
	console.info('Checking mac permissions...');

	const { showBanner, closeBanner } = useApp.getState();
	showBanner({
		id: 'macPermissions',
		color: '#00B7AB',
		content: (
			<>
				<Text size="sm"><b>LibreRambox needs permissions to use Microphone and Camera for the apps.</b></Text>
				<Button size="xs" variant="white" onClick={async () => {
					await askForMediaAccess();
					closeBanner('macPermissions');
				}}>Grant permissions</Button>
				<Button size="xs" variant="white" onClick={() => {
					closeBanner('macPermissions');
					localStorage.setItem('hideMacPermissions', 'true');
				}}>Never ask again</Button>
			</>
		),
	});
}

export function showServicesNotLoaded() {
	useApp.getState().showBanner({
		id: 'servicesNotLoaded',
		color: '#efef6d',
		content: (
			<>
				<Text size="sm" c="dark"><b>Services couldn't be loaded, some LibreRambox features will not be available.</b></Text>
				<Button size="xs" onClick={() => ipc.send('reloadApp')}>Reload</Button>
			</>
		),
	});
}

// Default active service from the preferences
export function selectDefaultTab() {
	const defaultService = String(getConfig().default_service);
	let tab: string | null = defaultService;
	if ( defaultService === 'last' ) tab = localStorage.getItem('last_active_service');
	if ( !tab || tab === HOME_TAB ) return;
	const id = Number(tab.replace('tab_', ''));
	if ( getService(id)?.enabled ) activateTab(id);
}

export function initDontDisturb() {
	if ( localStorage.getItem('dontDisturb') === null ) localStorage.setItem('dontDisturb', 'false');
	ipc.send('setDontDisturb', localStorage.getItem('dontDisturb')); // We store it in config
	if ( localStorage.getItem('locked') ) console.info('Lock LibreRambox:', 'Enabled');
}
