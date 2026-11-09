import { useState } from 'react';
import { ActionIcon, Checkbox, Group, Paper, Text, TextInput, Title, Tooltip } from '@mantine/core';
import { IconBellOff, IconSettings, IconTrash, IconVolumeOff } from '@tabler/icons-react';
import { t } from '../../i18n';
import { useServices } from '../../store/services';
import { getCatalogEntry } from '../../store/catalog';
import type { Service } from '../../store/types';
import { useUi } from '../../store/ui';
import { activateTab, removeAllServices, removeService } from '../../actions';
import { serviceIcon } from '../../util/service';

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function MyServices() {
	const services = useServices((s) => s.services);
	const groups = (['left', 'right'] as const)
		.map((align) => ({ align, services: services.filter((s) => s.align === align).sort((a, b) => a.position - b.position) }))
		.filter((g) => g.services.length > 0);

	return (
		<Paper className="home-panel my-services" withBorder>
			<Group className="home-panel-header" justify="space-between" wrap="nowrap">
				<Title order={5}>{t('app.main[4]')}</Title>
				<Tooltip label={t('app.main[10]')}>
					<ActionIcon variant="subtle" color="gray" disabled={services.length === 0} onClick={removeAllServices}>
						<IconTrash size={18} />
					</ActionIcon>
				</Tooltip>
			</Group>
			<div className="home-panel-body">
				{services.length === 0 && <Text p="md" c="dimmed">{t('app.main[15]')}</Text>}
				{groups.map((group) => (
					<div key={group.align}>
						<Text className="group-header" size="xs" fw={700}>
							{capitalize(group.align)} ({group.services.length} {group.services.length > 1 ? t('app.main[9]') : t('app.main[8]')})
						</Text>
						{group.services.map((service) => <ServiceRow key={service.id} service={service} />)}
					</div>
				))}
			</div>
		</Paper>
	);
}

function ServiceRow({ service }: { service: Service }) {
	const update = useServices((s) => s.update);
	const openServiceDialog = useUi((s) => s.openServiceDialog);
	const [editing, setEditing] = useState(false);

	const rename = (name: string) => {
		setEditing(false);
		if ( name !== service.name ) update(service.id, { name });
	};

	return (
		<Group className="service-row" gap="xs" wrap="nowrap">
			<Tooltip label={capitalize(service.type)}>
				<img
					src={serviceIcon(service)}
					width={32}
					alt=""
					style={{ filter: service.enabled ? undefined : 'grayscale(1)', cursor: 'pointer' }}
					onDoubleClick={() => service.enabled && activateTab(service.id)}
				/>
			</Tooltip>
			{editing ? (
				<TextInput
					size="xs"
					flex={1}
					defaultValue={service.name}
					autoFocus
					onBlur={(e) => rename(e.currentTarget.value)}
					onKeyDown={(e) => {
						if ( e.key === 'Enter' ) rename(e.currentTarget.value);
						if ( e.key === 'Escape' ) setEditing(false);
					}}
				/>
			) : (
				<Text flex={1} truncate onDoubleClick={() => setEditing(true)}>{service.name}</Text>
			)}
			{!service.notifications && <Tooltip label={t('app.main[11]')}><IconBellOff size={16} className="status-icon" /></Tooltip>}
			{service.muted && <Tooltip label={t('app.main[12]')}><IconVolumeOff size={16} className="status-icon" /></Tooltip>}
			<Group gap={2} className="row-actions" wrap="nowrap">
				<Tooltip label={t('app.main[13]')}>
					<ActionIcon variant="subtle" color="gray" onClick={() => openServiceDialog({ mode: 'edit', service, entry: getCatalogEntry(service.type) })}>
						<IconSettings size={16} />
					</ActionIcon>
				</Tooltip>
				<Tooltip label={t('app.main[14]')}>
					<ActionIcon variant="subtle" color="gray" onClick={() => removeService(service.id)}>
						<IconTrash size={16} />
					</ActionIcon>
				</Tooltip>
			</Group>
			<Tooltip label={'Service ' + (service.enabled ? 'Enabled' : 'Disabled')}>
				<Checkbox checked={service.enabled} onChange={(e) => update(service.id, { enabled: e.currentTarget.checked })} />
			</Tooltip>
		</Group>
	);
}
