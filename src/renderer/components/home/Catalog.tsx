import { useEffect, useMemo, useRef, useState } from 'react';
import { Checkbox, CloseButton, Group, Paper, TextInput, Title, Tooltip } from '@mantine/core';
import { IconSearch } from '@tabler/icons-react';
import { resourceUrl } from '../../electron';
import { t } from '../../i18n';
import { useCatalog, CUSTOM_SERVICE_ID } from '../../store/catalog';
import type { CatalogEntry } from '../../store/types';
import { useUi } from '../../store/ui';

export function Catalog() {
	const entries = useCatalog((s) => s.entries);
	const openServiceDialog = useUi((s) => s.openServiceDialog);
	const [types, setTypes] = useState({ messaging: true, email: true });
	const [search, setSearch] = useState('');
	const searchRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const timer = setTimeout(() => searchRef.current?.focus(), 1000);
		return () => clearTimeout(timer);
	}, []);

	// The custom service is always offered
	const visible = useMemo(() => entries.filter((entry) => {
		if ( entry.type === CUSTOM_SERVICE_ID ) return true;
		if ( !types[entry.type as keyof typeof types] ) return false;
		return entry.name.toLowerCase().includes(search.toLowerCase());
	}), [entries, types, search]);

	const add = (entry: CatalogEntry) => openServiceDialog({ mode: 'add', entry });

	return (
		<Paper className="home-panel catalog" withBorder>
			<Group className="home-panel-header" justify="space-between">
				<Title order={5}>{t('app.main[0]')}</Title>
				<Group gap="sm">
					<Checkbox label={t('app.main[1]')} checked={types.messaging} onChange={(e) => setTypes({ ...types, messaging: e.currentTarget.checked })} />
					<Checkbox label={t('app.main[2]')} checked={types.email} onChange={(e) => setTypes({ ...types, email: e.currentTarget.checked })} />
					<TextInput
						ref={searchRef}
						size="xs"
						w={170}
						value={search}
						onChange={(e) => setSearch(e.currentTarget.value)}
						onKeyDown={(e) => {
							// Two because the custom service is always listed
							if ( e.key === 'Enter' && visible.length === 2 ) {
								add(visible.find((entry) => entry.id !== CUSTOM_SERVICE_ID)!);
								setSearch('');
							}
						}}
						rightSection={search ? <CloseButton size="sm" onClick={() => setSearch('')} /> : <IconSearch size={14} />}
					/>
				</Group>
			</Group>
			<div className="home-panel-body">
				{visible.length === 0 ? (
					<div style={{ padding: 20 }}>{t('app.main[3]')}</div>
				) : (
					visible.map((entry) => (
						<Tooltip key={entry.id} label={entry.description} multiline w={260} openDelay={500}>
							<div className="service" onClick={() => add(entry)}>
								<img src={resourceUrl('icons/' + entry.logo)} width={48} alt="" />
								<span>{entry.name}</span>
							</div>
						</Tooltip>
					))
				)}
			</div>
		</Paper>
	);
}
