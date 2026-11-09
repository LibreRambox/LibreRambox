import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { Button, Group, Loader, PasswordInput, Stack, Text } from '@mantine/core';
import { ipc } from './electron';
import { getConfig, setConfig } from './config';
import { t } from './i18n';
import { HOME_TAB, useApp, type TabId } from './store/app';
import { getService, tabOrder, useServices } from './store/services';
import type { Service } from './store/types';
import { useUi } from './store/ui';
import { md5 } from './util/md5';
import { clearServiceData } from './util/service';
import { registry } from './util/registry';

/**
 * TABS
 */

// Home tab followed by the services in tab bar order
export function orderedTabs(): TabId[] {
	const { left, right } = tabOrder(useServices.getState().services);
	return [HOME_TAB, ...left.map((s) => s.id), ...right.map((s) => s.id)];
}

export function activateTab(tab: TabId) {
	useApp.getState().setActiveTab(tab);
	// Same format as the former Ext tab ids, so older builds still find the last service
	localStorage.setItem('last_active_service', tab === HOME_TAB ? HOME_TAB : 'tab_' + tab);
}

// Index 0 is the home tab, 1..n the services
export function activateTabAt(index: number) {
	const tabs = orderedTabs();
	if ( index >= 0 && index < tabs.length ) activateTab(tabs[index]);
}

export function cycleTab(direction: 1 | -1) {
	const tabs = orderedTabs();
	const index = tabs.indexOf(useApp.getState().activeTab);
	activateTab(tabs[(index + direction + tabs.length) % tabs.length]);
}

export function activeHandle() {
	const tab = useApp.getState().activeTab;
	return tab === HOME_TAB ? undefined : registry.get(tab);
}

/**
 * DON'T DISTURB
 */
export function setDontDisturb(enabled: boolean, showToast = false) {
	console.info('Dont Disturb:', enabled ? 'Enabled' : 'Disabled');
	// Muting and notifications of each service follow this state (see ServiceView)
	useApp.getState().setDontDisturb(enabled);
	localStorage.setItem('dontDisturb', String(enabled));
	ipc.send('setDontDisturb', enabled);

	if ( !showToast ) return;
	notifications.show({ title: "Don't Disturb", message: enabled ? 'ENABLED' : 'DISABLED', autoClose: 2000, withCloseButton: false, position: 'top-center' });
}

export function toggleDontDisturb() {
	setDontDisturb(!useApp.getState().dontDisturb, true);
}

/**
 * LOCK
 */
export function lockLibreRambox() {
	const masterPassword = getConfig().master_password;

	const setLock = (hash: string) => {
		console.info('Lock LibreRambox:', 'Enabled');
		// Saved in localStorage to show the lock screen when the app is reopened
		localStorage.setItem('locked', hash);
		setDontDisturb(true);
		useApp.getState().setLocked(true);
	};

	const askTempPassword = () => {
		const id = modals.open({
			title: t('app.main[19]'),
			children: <TempPasswordForm onCancel={() => modals.close(id)} onSubmit={(password) => {
				modals.close(id);
				setLock(md5(password));
			}} />,
		});
	};

	if ( masterPassword ) {
		modals.openConfirmModal({
			title: t('app.main[19]'),
			children: <Text>Do you want to use the Master Password as your temporal password?</Text>,
			labels: { confirm: 'Yes', cancel: 'No' },
			onConfirm: () => setLock(masterPassword),
			onCancel: askTempPassword,
		});
	} else {
		askTempPassword();
	}
}

function TempPasswordForm({ onSubmit, onCancel }: { onSubmit: (password: string) => void; onCancel: () => void }) {
	const [password, setPassword] = useState('');
	const [repeat, setRepeat] = useState('');
	const [error, setError] = useState('');
	const submit = () => {
		if ( password !== repeat ) return setError(t('app.window[25]'));
		onSubmit(password);
	};
	const onEnter = (e: React.KeyboardEvent) => e.key === 'Enter' && submit();

	return (
		<Stack>
			<PasswordInput label={t('app.window[22]')} value={password} onChange={(e) => setPassword(e.currentTarget.value)} onKeyDown={onEnter} data-autofocus />
			<PasswordInput label={t('app.window[23]')} value={repeat} error={error} onChange={(e) => { setRepeat(e.currentTarget.value); setError(''); }} onKeyDown={onEnter} />
			<Group justify="flex-end">
				<Button variant="default" onClick={onCancel}>{t('button[1]')}</Button>
				<Button onClick={submit}>OK</Button>
			</Group>
		</Stack>
	);
}

// Returns false when the password is wrong
export function unlockLibreRambox(password: string): boolean {
	if ( localStorage.getItem('locked') !== md5(password) ) return false;
	console.info('Lock LibreRambox:', 'Disabled');
	localStorage.removeItem('locked');
	useApp.getState().setLocked(false);
	setDontDisturb(false);
	return true;
}

/**
 * REMOVING SERVICES
 */
function showWait() {
	return modals.open({
		title: 'Removing...',
		withCloseButton: false,
		closeOnClickOutside: false,
		closeOnEscape: false,
		children: <Stack align="center"><Loader /><Text>Please wait until we clear all.</Text></Stack>,
	});
}

async function removeServiceFn(service: Service) {
	try {
		await clearServiceData(service);
	} catch ( err ) {
		console.log(err);
	}
	const config = getConfig();
	if ( String(config.default_service) === String(service.id) ) setConfig({ ...config, default_service: HOME_TAB });
	if ( useApp.getState().activeTab === service.id ) activateTab(HOME_TAB);
	useServices.getState().remove(service.id);
}

export function removeService(id: number) {
	const service = getService(id);
	if ( !service ) return;
	modals.openConfirmModal({
		title: t('app.window[12]'),
		children: <Text>{t('app.window[13]')} <b>{service.name}</b>?</Text>,
		labels: { confirm: 'Yes', cancel: 'No' },
		onConfirm: async () => {
			const wait = showWait();
			await removeServiceFn(service);
			modals.close(wait);
		},
	});
}

export function removeAllServices() {
	modals.openConfirmModal({
		title: t('app.window[12]'),
		children: <Text>{t('app.window[14]')}</Text>,
		labels: { confirm: 'Yes', cancel: 'No' },
		onConfirm: async () => {
			const wait = showWait();
			for ( const service of useServices.getState().services ) await removeServiceFn(service);
			modals.close(wait);
		},
	});
}

export function openPreferences() {
	useUi.getState().setPreferencesOpen(true);
}

export function alert(title: string, message: React.ReactNode, color?: string) {
	modals.open({ title: <Text fw={600} c={color}>{title}</Text>, children: typeof message === 'string' ? <Text>{message}</Text> : message });
}

export function confirm(title: string, message: string, onYes: () => void) {
	modals.openConfirmModal({ title, children: <Text>{message}</Text>, labels: { confirm: 'Yes', cancel: 'No' }, onConfirm: onYes });
}
