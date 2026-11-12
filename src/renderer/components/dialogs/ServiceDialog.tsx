import { useMemo, useState } from 'react';
import { Anchor, Button, Checkbox, Collapse, Fieldset, Group, Modal, NumberInput, Radio, SegmentedControl, SimpleGrid, Stack, Text, TextInput, Textarea, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconInfoCircle } from '@tabler/icons-react';
import { t } from '../../i18n';
import { useServices } from '../../store/services';
import { useUi, type ServiceDialogState } from '../../store/ui';
import type { Service } from '../../store/types';
import { SERVICE_DEFAULTS } from '../../store/persistence';
import { activateTab, confirm } from '../../actions';
import { registry } from '../../util/registry';
import { serviceIcon } from '../../util/service';

type ServerMode = 'official' | 'custom';

// Catalog URLs may contain a "___" placeholder (e.g. https://___.slack.com/) that the user fills in.
// Services flagged "custom_domain" can also point to a self hosted server.
function urlSetup(state: ServiceDialogState) {
	const entry = state.entry;
	const template = entry?.url ?? (state.mode === 'edit' ? state.service.url : '___');
	const hasPlaceholder = template.includes('___');
	const [prefix, suffix = ''] = template.split('___');
	const isCustomType = (entry?.type ?? 'custom') === 'custom' || template === '___';
	const customDomain = !!entry?.custom_domain;
	const stripSlash = (s: string) => s.replace(/\/$/, '');

	let mode: ServerMode = 'official';
	let value = hasPlaceholder ? '' : template;
	if ( state.mode === 'edit' ) {
		const url = state.service.url;
		const official = hasPlaceholder ? url.startsWith(prefix) && stripSlash(url).endsWith(stripSlash(suffix)) : url === template;
		mode = official || !customDomain ? 'official' : 'custom';
		if ( isCustomType || mode === 'custom' || !hasPlaceholder ) value = url;
		else {
			let middle = url.slice(prefix.length);
			if ( suffix && middle.endsWith(suffix) ) middle = middle.slice(0, -suffix.length);
			else if ( stripSlash(suffix) && middle.endsWith(stripSlash(suffix)) ) middle = middle.slice(0, -stripSlash(suffix).length);
			value = stripSlash(middle);
		}
	}

	return {
		template, hasPlaceholder, prefix, isCustomType, customDomain,
		officialLabel: hasPlaceholder ? stripSlash(suffix) : 'Official Server',
		showUrl: hasPlaceholder || customDomain,
		mode, value,
	};
}

const isValidUrl = (value: string) => {
	try {
		const url = new URL(value);
		return ['http:', 'https:', 'ftp:'].includes(url.protocol) && url.hostname.length > 0;
	} catch {
		return false;
	}
};

const toMinutes = (value: string | number, fallback: number) => {
	const n = parseInt(String(value), 10);
	return Number.isNaN(n) || n < 1 ? fallback : n;
};

export function ServiceDialog() {
	const state = useUi((s) => s.serviceDialog);
	const close = useUi((s) => s.closeServiceDialog);
	if ( !state ) return null;
	// Keyed so the form starts fresh for every service
	return <ServiceForm key={state.mode === 'edit' ? 'edit' + state.service.id : 'add' + state.entry.id} state={state} onClose={close} />;
}

function ServiceForm({ state, onClose }: { state: ServiceDialogState; onClose: () => void }) {
	const setup = useMemo(() => urlSetup(state), [state]);
	const edit = state.mode === 'edit';
	const record: Pick<Service, 'type' | 'logo' | 'name'> = edit ? state.service : { type: state.entry.id, logo: state.entry.logo, name: state.entry.name };
	const isCustom = record.type === 'custom';
	const base: Omit<Service, 'id' | 'type' | 'name' | 'url'> = edit ? state.service : SERVICE_DEFAULTS;
	const note = state.entry?.note ?? '';

	const [mode, setMode] = useState<ServerMode>(setup.mode);
	const [url, setUrl] = useState(setup.value);
	const [urlError, setUrlError] = useState('');
	const [advancedOpen, setAdvancedOpen] = useState(false);
	const [values, setValues] = useState({
		name: isCustom && !edit ? '' : record.name,
		logo: isCustom ? (edit ? record.logo : '') : record.logo,
		align: base.align,
		muted: base.muted,
		tabname: base.tabname,
		notifications: base.notifications,
		statusbar: base.statusbar,
		disableAutoReloadOnFail: base.disableAutoReloadOnFail,
		trust: base.trust,
		displayTabUnreadCounter: base.displayTabUnreadCounter,
		includeInGlobalUnreadCounter: base.includeInGlobalUnreadCounter,
		hibernate: base.hibernate,
		hibernateAfter: base.hibernateAfter as number | string,
		hibernateOnSelect: base.hibernateOnSelect,
		hibernateRewake: base.hibernateRewake,
		hibernateRewakeEvery: base.hibernateRewakeEvery as number | string,
		hibernateRewakeFor: base.hibernateRewakeFor as number | string,
		js_unread: base.js_unread,
	});
	const set = <K extends keyof typeof values>(key: K, value: (typeof values)[K]) => setValues((v) => ({ ...v, [key]: value }));
	const check = (key: keyof typeof values) => ({
		checked: values[key] as boolean,
		onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.currentTarget.checked as never),
	});

	const official = mode === 'official';
	const readOnly = official && !setup.hasPlaceholder && !setup.isCustomType;

	const switchMode = (next: ServerMode) => {
		setMode(next);
		setUrlError('');
		if ( next === setup.mode ) setUrl(setup.value);
		else setUrl(next === 'custom' || setup.hasPlaceholder ? '' : setup.template);
	};

	const save = () => {
		if ( setup.showUrl || setup.isCustomType ) {
			if ( url.trim() === '' ) return setUrlError('This field is required');
			if ( (setup.isCustomType || !official) && !isValidUrl(url) ) return setUrlError('This field should be a URL in the format "http://www.example.com"');
		}
		const finalUrl = official && setup.hasPlaceholder && !setup.isCustomType ? setup.template.replace('___', url) : url;

		const data = {
			...values,
			url: finalUrl,
			hibernateAfter: toMinutes(values.hibernateAfter, 15),
			hibernateRewakeEvery: toMinutes(values.hibernateRewakeEvery, 15),
			hibernateRewakeFor: toMinutes(values.hibernateRewakeFor, 1),
		};

		if ( state.mode === 'edit' ) {
			const old = state.service;
			useServices.getState().update(old.id, data);
			// Apply the JS Code of the Tab
			if ( old.js_unread !== data.js_unread ) {
				confirm(t('app.window[8]').toUpperCase(), 'LibreRambox needs to reload the service to execute the new JavaScript code. Do you want to do it now?', () => registry.get(old.id)?.reload());
			}
		} else {
			const service = useServices.getState().add({ ...data, type: state.entry.id, enabled: true, zoomLevel: 0 });
			activateTab(service.id);
		}
		onClose();
	};

	const onEnter = (e: React.KeyboardEvent) => {
		if ( e.key === 'Enter' ) save();
	};

	const title = (edit ? t('app.window[1]') : t('app.window[0]')) + ' ' + record.name;
	const icon = isCustom && !edit ? serviceIcon({ type: 'custom', logo: '' }) : serviceIcon(record);

	return (
		<Modal opened onClose={onClose} size={520} title={<Group gap="xs"><img src={icon} width={18} alt="" />{title}</Group>}>
			<Stack gap="sm">
				<TextInput label={t('app.window[2]')} value={values.name} onChange={(e) => set('name', e.currentTarget.value)} onKeyDown={onEnter} data-autofocus />

				{(setup.showUrl || setup.isCustomType) && (
					<Stack gap={4}>
						<Text size="sm" fw={500}>{t('app.window[17]')}</Text>
						<Group gap={0} wrap="nowrap">
							{official && setup.hasPlaceholder && !setup.isCustomType && <Button variant="default" className="url-prefix">{setup.prefix}</Button>}
							<TextInput
								flex={1}
								value={url}
								readOnly={readOnly}
								placeholder={setup.isCustomType || !official ? 'https://' : ''}
								error={urlError}
								onChange={(e) => { setUrl(e.currentTarget.value); setUrlError(''); }}
								onKeyDown={onEnter}
							/>
							{!setup.isCustomType && (
								<SegmentedControl
									ml="xs"
									value={mode}
									onChange={(v) => switchMode(v as ServerMode)}
									data={[
										{ value: 'official', label: setup.officialLabel },
										{ value: 'custom', label: 'Custom Server', disabled: !setup.customDomain },
									]}
								/>
							)}
						</Group>
					</Stack>
				)}

				{isCustom && (
					<TextInput label={t('app.window[18]')} placeholder="https://url.com/image.png" value={values.logo} onChange={(e) => set('logo', e.currentTarget.value)} onKeyDown={onEnter} />
				)}

				<Fieldset legend={t('app.window[3]')}>
					<SimpleGrid cols={2} spacing="xs">
						<Checkbox label={t('app.window[4]')} checked={values.align === 'right'} onChange={(e) => set('align', e.currentTarget.checked ? 'right' : 'left')} />
						<Checkbox label={t('app.window[6]')} {...check('muted')} />
						<Checkbox label="Show service name in Tab" {...check('tabname')} />
						<Checkbox label={t('app.window[5]')} {...check('notifications')} />
						<Checkbox label="Always display Status Bar" {...check('statusbar')} />
						<Checkbox label="Disable auto-reload on fail" {...check('disableAutoReloadOnFail')} />
						{isCustom && <Checkbox label={t('app.window[19]')} {...check('trust')} />}
					</SimpleGrid>
				</Fieldset>

				<Fieldset legend="Unread counter">
					<SimpleGrid cols={2} spacing="xs">
						<Checkbox label="Display tab unread counter" {...check('displayTabUnreadCounter')} />
						<Checkbox label="Include in global unread counter" {...check('includeInGlobalUnreadCounter')} />
					</SimpleGrid>
				</Fieldset>

				<Fieldset legend={t('app.hibernation[0]')}>
					<Checkbox label={t('app.hibernation[1]')} {...check('hibernate')} />
					<Collapse expanded={values.hibernate}>
						<Stack gap="xs" mt="xs">
							<NumberInput label={t('app.hibernation[2]')} min={1} allowDecimal={false} w={330} value={values.hibernateAfter} onChange={(v) => set('hibernateAfter', v)} />
							<Radio.Group label={t('app.hibernation[3]')} value={values.hibernateOnSelect} onChange={(v) => set('hibernateOnSelect', v as 'auto' | 'ask')}>
								<Stack gap={4} mt={4}>
									<Radio value="auto" label={t('app.hibernation[4]')} />
									<Radio value="ask" label={t('app.hibernation[5]')} />
								</Stack>
							</Radio.Group>
							<Checkbox label={t('app.hibernation[6]')} {...check('hibernateRewake')} />
							<Collapse expanded={values.hibernateRewake}>
								<Group gap="sm">
									<NumberInput label={t('app.hibernation[7]')} min={1} allowDecimal={false} w={150} value={values.hibernateRewakeEvery} onChange={(v) => set('hibernateRewakeEvery', v)} />
									<NumberInput label={t('app.hibernation[8]')} min={1} allowDecimal={false} w={170} value={values.hibernateRewakeFor} onChange={(v) => set('hibernateRewakeFor', v)} />
								</Group>
							</Collapse>
							<Text size="xs" c="dimmed" dangerouslySetInnerHTML={{ __html: t('app.hibernation[9]') }} />
						</Stack>
					</Collapse>
				</Fieldset>

				<Fieldset
					legend={
						<UnstyledButton onClick={() => setAdvancedOpen((o) => !o)}>
							<Group gap={4}>{advancedOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}{t('app.window[7]')}</Group>
						</UnstyledButton>
					}
				>
					<Collapse expanded={advancedOpen}>
						<Textarea
							label={<>{t('app.window[8]')} (<Anchor href="https://github.com/LibreRambox/LibreRambox/wiki/Inject-JavaScript-Code" target="_blank" size="sm">{t('app.window[9]')}</Anchor>)</>}
							minRows={5}
							autosize
							maxRows={10}
							value={values.js_unread}
							onChange={(e) => set('js_unread', e.currentTarget.value)}
						/>
					</Collapse>
				</Fieldset>

				{note !== '' && (
					<Group className="service-note" wrap="nowrap">
						<IconInfoCircle size={40} style={{ flexShrink: 0 }} />
						<Text size="sm" dangerouslySetInnerHTML={{ __html: note }} />
					</Group>
				)}

				<Group justify="space-between" mt="sm">
					<Button variant="default" onClick={onClose}>{t('button[1]')}</Button>
					<Button onClick={save}>{title}</Button>
				</Group>
			</Stack>
		</Modal>
	);
}
