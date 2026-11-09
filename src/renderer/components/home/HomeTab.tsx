import { Button, Group, Tooltip, ActionIcon } from '@mantine/core';
import { IconBell, IconBellOff, IconLock, IconSettings } from '@tabler/icons-react';
import { platform } from '../../electron';
import { t } from '../../i18n';
import { useApp } from '../../store/app';
import { lockLibreRambox, openPreferences, toggleDontDisturb } from '../../actions';
import { Catalog } from './Catalog';
import { MyServices } from './MyServices';

export function HomeTab() {
	const dontDisturb = useApp((s) => s.dontDisturb);
	const shortcut = (key: string) => t('app.main[18]') + (platform === 'darwin' ? ': Cmd + Alt + ' + key : ': Alt + Shift + ' + key);

	return (
		<div className="home-tab">
			<Group className="home-toolbar" justify="space-between" wrap="nowrap">
				<Group gap="xs" wrap="nowrap">
					<Tooltip label={<>{t('app.main[17]')}<br /><b>{shortcut('D')}</b></>}>
						<Button
							variant={dontDisturb ? 'white' : 'subtle'}
							color={dontDisturb ? 'dark' : 'white'}
							leftSection={dontDisturb ? <IconBellOff size={16} /> : <IconBell size={16} />}
							onClick={toggleDontDisturb}
						>
							{t('app.main[16]')}: {dontDisturb ? t('app.window[20]') : t('app.window[21]')}
						</Button>
					</Tooltip>
					<Tooltip label={<>{t('app.main[20]')}<br /><b>{shortcut('L')}</b></>}>
						<Button variant="subtle" color="white" leftSection={<IconLock size={16} />} onClick={lockLibreRambox}>
							{t('app.main[19]')}
						</Button>
					</Tooltip>
				</Group>
				<Tooltip label={t('preferences[0]')}>
					<ActionIcon variant="subtle" color="white" size="lg" onClick={openPreferences}>
						<IconSettings size={20} />
					</ActionIcon>
				</Tooltip>
			</Group>
			<div className="home-panels">
				<Catalog />
				<MyServices />
			</div>
		</div>
	);
}
