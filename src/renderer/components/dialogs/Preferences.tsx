import { useState } from 'react';
import { Anchor, Button, Checkbox, Fieldset, Group, Modal, NumberInput, PasswordInput, Select, Stack, Text, TextInput } from '@mantine/core';
import { ipc, platform } from '../../electron';
import { getConfig, setConfig, type AppConfig } from '../../config';
import { t } from '../../i18n';
import { HOME_TAB } from '../../store/app';
import { useServices } from '../../store/services';
import { useUi } from '../../store/ui';
import { alert, confirm } from '../../actions';

const LANGUAGES: [string, string][] = [
	['af', 'Afrikaans'], ['ar', 'Arabic'], ['bs2', 'Barndutsch, Switzerland'], ['bn', 'Bengali'], ['bg', 'Bulgarian'],
	['ca', 'Catalan'], ['ceb', 'Cebuano'], ['zh-CN', 'Chinese Simplified'], ['zh-TW', 'Chinese Traditional'], ['hr', 'Croatian'],
	['cs', 'Czech'], ['da', 'Danish'], ['nl', 'Dutch'], ['en', 'English'], ['fi', 'Finnish'], ['fil', 'Filipino'], ['fr', 'French'],
	['de', 'German'], ['de-CH', 'German, Switzerland'], ['el', 'Greek'], ['he', 'Hebrew'], ['hi', 'Hindi'], ['hu', 'Hungarian'],
	['id', 'Indonesian'], ['it', 'Italian'], ['ja', 'Japanese'], ['ko', 'Korean'], ['no', 'Norwegian'], ['fa', 'Persian'],
	['pl', 'Polish'], ['pt-PT', 'Portuguese'], ['pt-BR', 'Portuguese (Brazilian)'], ['ro', 'Romanian'], ['ru', 'Russian'],
	['sr', 'Serbian (Cyrillic)'], ['sk', 'Slovak'], ['es-ES', 'Spanish'], ['sv-SE', 'Swedish'], ['tl', 'Tagalog'], ['th', 'Thai'],
	['tr', 'Turkish'], ['uk', 'Ukrainian'], ['ur-PK', 'Urdu (Pakistan)'], ['vi', 'Vietnamese'],
];

const FIELDS = [
	'locale', 'auto_launch', 'start_minimized', 'hide_menu_bar', 'tabbar_location', 'hide_tabbar_labels', 'default_service',
	'window_display_behavior', 'window_close_behavior', 'always_on_top', 'systemtray_indicator', 'flash_frame', 'disable_gpu',
	'enable_hidpi_support', 'user_agent', 'proxy', 'proxyHost', 'proxyPort', 'proxyLogin', 'proxyPassword',
] as const;

export function Preferences() {
	const open = useUi((s) => s.preferencesOpen);
	const setOpen = useUi((s) => s.setPreferencesOpen);
	if ( !open ) return null;
	return <PreferencesForm onClose={() => setOpen(false)} />;
}

function PreferencesForm({ onClose }: { onClose: () => void }) {
	const services = useServices((s) => s.services);
	const refreshConfig = useUi((s) => s.refreshConfig);
	const [config] = useState(getConfig);
	const [values, setValues] = useState({
		...config,
		default_service: String(config.default_service),
		master_password_enabled: !!config.master_password,
		master_password1: '',
		master_password2: '',
	});
	const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));
	const check = (key: keyof typeof values) => ({
		checked: !!values[key],
		onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.currentTarget.checked as never),
	});

	const passwordMismatch = values.master_password1 !== values.master_password2;

	const save = async () => {
		const { master_password_enabled, master_password1, master_password2 } = values;
		// Only the fields of this form: other config values (window bounds...) may have changed meanwhile
		const result: Partial<AppConfig> = {};
		for ( const key of FIELDS ) (result as Record<string, unknown>)[key] = values[key];

		// A service id is stored as a number, like before
		result.default_service = /^\d+$/.test(values.default_service) ? Number(values.default_service) : values.default_service;

		if ( master_password_enabled ) {
			// Only one of "password" or "password confirmation" filled, or they don't match
			if ( !!master_password1 !== !!master_password2 || master_password1 !== master_password2 ) return;
			if ( master_password1 ) {
				try {
					await ipc.invoke('password:set-master', master_password1);
				} catch ( err ) {
					console.error('Could not update master password', err);
					return;
				}
			}
		} else {
			try {
				await ipc.invoke('password:set-master', null);
			} catch ( err ) {
				console.error('Could not disable master password', err);
				return;
			}
		}

		// Proxy
		if ( values.proxy && (!values.proxyHost || !values.proxyPort) ) return;

		// Display behaviour
		if ( values.window_display_behavior === 'show_taskbar' && values.window_close_behavior === 'keep_in_tray' ) {
			alert('Action required', 'You need to change the window closing behaviour because "Keep in tray" is not possible.');
			return;
		}

		const relaunch = (message: string) => confirm('Action required', message, () => ipc.send('relaunchApp'));
		if ( values.user_agent !== config.user_agent ) relaunch('To change the user agent of LibreRambox, you need to reload the app. Do you want to do it now?');
		if ( values.locale !== config.locale ) {
			localStorage.setItem('locale', values.locale);
			relaunch('To change the language of LibreRambox, you need to reload the app. Do you want to do it now?');
		}

		setConfig(result);
		refreshConfig();
		onClose();
	};

	const mac = platform === 'darwin';

	return (
		<Modal opened onClose={onClose} title={t('preferences[0]')} size={440}>
			<Stack gap="sm">
				<Select
					label="Language"
					allowDeselect={false}
					data={LANGUAGES.map(([value, label]) => ({ value, label }))}
					value={values.locale}
					onChange={(v) => v && set('locale', v)}
				/>
				<Text size="xs" c="dimmed">English is the only language that has full translation. We are working with all the others, help us!</Text>

				<Checkbox label={t('preferences[5]')} {...check('auto_launch')} />
				<Checkbox label={t('preferences[4]')} {...check('start_minimized')} />
				{!mac && <Checkbox label={<>{t('preferences[1]')} (<code>Alt</code> key to display)</>} {...check('hide_menu_bar')} />}
				<Select
					label={t('preferences[11]')}
					allowDeselect={false}
					data={[{ value: 'top', label: 'Top' }, { value: 'left', label: 'Left' }, { value: 'bottom', label: 'Bottom' }, { value: 'right', label: 'Right' }]}
					value={values.tabbar_location}
					onChange={(v) => v && set('tabbar_location', v as AppConfig['tabbar_location'])}
				/>
				<Checkbox label={t('preferences[28]')} {...check('hide_tabbar_labels')} />
				<Select
					label={t('preferences[12]')}
					allowDeselect={false}
					data={[
						{ value: HOME_TAB, label: 'LibreRambox Tab' },
						{ value: 'last', label: 'Last Active Service' },
						...services.map((s) => ({ value: String(s.id), label: s.name || s.type })),
					]}
					value={values.default_service}
					onChange={(v) => v && set('default_service', v)}
				/>
				{!mac && (
					<Select
						label={t('preferences[13]')}
						allowDeselect={false}
						data={[
							{ value: 'show_taskbar', label: t('preferences[14]') },
							{ value: 'show_trayIcon', label: t('preferences[15]') },
							{ value: 'taskbar_tray', label: t('preferences[16]') },
						]}
						value={values.window_display_behavior}
						onChange={(v) => v && set('window_display_behavior', v as AppConfig['window_display_behavior'])}
					/>
				)}
				{!mac && (
					<Select
						label={t('preferences[17]')}
						allowDeselect={false}
						data={[
							{ value: 'keep_in_tray', label: t('preferences[18]') },
							{ value: 'keep_in_tray_and_taskbar', label: t('preferences[19]') },
							{ value: 'quit', label: t('preferences[20]') },
						]}
						value={values.window_close_behavior}
						onChange={(v) => v && set('window_close_behavior', v as AppConfig['window_close_behavior'])}
					/>
				)}
				<Checkbox label={t('preferences[21]')} {...check('always_on_top')} />
				{!mac && <Checkbox label={t('preferences[22]')} {...check('systemtray_indicator')} />}
				<Checkbox label={mac ? t('preferences[10]') : t('preferences[9]')} {...check('flash_frame')} />
				<Checkbox label={t('preferences[23]')} {...check('disable_gpu')} />
				{platform === 'win32' && <Checkbox label={t('preferences[8]')} {...check('enable_hidpi_support')} />}
				<TextInput
					label="Override User-Agent for all services (needs to relaunch)"
					placeholder="Leave blank for default user agent"
					value={values.user_agent}
					onChange={(e) => set('user_agent', e.currentTarget.value)}
				/>

				<Fieldset legend={<Checkbox label={t('preferences[24]')} checked={values.master_password_enabled} onChange={(e) => set('master_password_enabled', e.currentTarget.checked)} />}>
					{values.master_password_enabled && (
						<Group grow align="flex-start">
							<PasswordInput label={t('preferences[25]')} value={values.master_password1} onChange={(e) => set('master_password1', e.currentTarget.value)} />
							<PasswordInput
								label={t('preferences[26]')}
								value={values.master_password2}
								error={passwordMismatch && values.master_password2 ? 'Passwords do not match' : undefined}
								onChange={(e) => set('master_password2', e.currentTarget.value)}
							/>
						</Group>
					)}
				</Fieldset>

				<Fieldset
					legend={
						<Group gap={4}>
							<Checkbox label="Proxy (needs to relaunch) -" {...check('proxy')} />
							<Anchor href="https://github.com/LibreRambox/LibreRambox/wiki/FREE-PROXY-SERVERS" target="_blank" size="sm">Free Proxy Servers</Anchor>
						</Group>
					}
				>
					{values.proxy && (
						<Stack gap="xs">
							<TextInput label="Host" value={values.proxyHost} error={!values.proxyHost ? 'Required' : undefined} onChange={(e) => set('proxyHost', e.currentTarget.value)} />
							<NumberInput label="Port" value={values.proxyPort} error={!values.proxyPort ? 'Required' : undefined} onChange={(v) => set('proxyPort', v)} />
							<TextInput label="Login" placeholder="Optional" value={values.proxyLogin} onChange={(e) => set('proxyLogin', e.currentTarget.value)} />
							<PasswordInput label="Password" placeholder="Optional" value={values.proxyPassword} onChange={(e) => set('proxyPassword', e.currentTarget.value)} />
						</Stack>
					)}
				</Fieldset>

				<Group justify="space-between" mt="sm">
					<Button variant="default" onClick={onClose}>{t('button[1]')}</Button>
					<Button onClick={save}>{t('button[4]')}</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
