import { Anchor, Modal, Stack, Text, Title } from '@mantine/core';
import { remote, resourceUrl } from '../../electron';
import { t } from '../../i18n';
import { useUi } from '../../store/ui';

export function About() {
	const open = useUi((s) => s.aboutOpen);
	const setOpen = useUi((s) => s.setAboutOpen);
	if ( !open ) return null;

	return (
		<Modal opened onClose={() => setOpen(false)} title={t('app.about[0]')} size={300}>
			<Stack gap={4}>
				<div style={{ textAlign: 'center' }}><img src={resourceUrl('Icon.png')} width={100} alt="" /></div>
				<Title order={4}>{t('app.about[1]')}</Title>
				<Text size="sm"><b>{t('app.about[2]')}:</b> {remote.app.getVersion()}</Text>
				<Text size="sm"><b>{t('app.about[3]')}:</b> {process.platform} ({process.arch})</Text>
				<Text size="sm"><b>Electron:</b> {process.versions.electron}</Text>
				<Text size="sm"><b>Chromium:</b> {process.versions.chrome}</Text>
				<Text size="sm"><b>Node:</b> {process.versions.node}</Text>
				<Anchor href="https://github.com/LibreRambox/LibreRambox" target="_blank" ta="center" mt="md">GitHub</Anchor>
			</Stack>
		</Modal>
	);
}
