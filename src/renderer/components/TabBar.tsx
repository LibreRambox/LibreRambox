import { useState } from 'react';
import { Menu, Button } from '@mantine/core';
import { IconChevronLeft, IconChevronRight, IconZoomIn, IconZoomOut, IconZoomReset, IconRefresh, IconMoon, IconSun, IconCode } from '@tabler/icons-react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, horizontalListSortingStrategy, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { resourceUrl } from '../electron';
import { t } from '../i18n';
import { HOME_TAB, useApp } from '../store/app';
import { tabOrder, useServices } from '../store/services';
import type { Service } from '../store/types';
import { useUi } from '../store/ui';
import { activateTab } from '../actions';
import { registry } from '../util/registry';
import { serviceIcon } from '../util/service';

const SPACER = 'spacer';

interface ContextMenuState {
	serviceId: number;
	x: number;
	y: number;
}

export function TabBar({ vertical }: { vertical: boolean }) {
	const services = useServices((s) => s.services);
	const reorder = useServices((s) => s.reorder);
	const activeTab = useApp((s) => s.activeTab);
	const dontDisturb = useApp((s) => s.dontDisturb);
	const [menu, setMenu] = useState<ContextMenuState | null>(null);

	const { left, right } = tabOrder(services);
	const items: (number | typeof SPACER)[] = [...left.map((s) => s.id), SPACER, ...right.map((s) => s.id)];

	// A small distance keeps plain clicks working
	const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

	// Dropping a service after the spacer aligns it to the right
	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if ( !over || active.id === over.id ) return;
		const ordered = arrayMove(items, items.indexOf(active.id as number), items.indexOf(over.id as number));
		const spacer = ordered.indexOf(SPACER);
		reorder(ordered.slice(0, spacer) as number[], ordered.slice(spacer + 1) as number[]);
	};

	return (
		<div className={'tabbar' + (vertical ? ' vertical' : '') + (dontDisturb ? ' dontdisturb' : '')}>
			<div className={'tab home' + (activeTab === HOME_TAB ? ' active' : '')} onClick={() => activateTab(HOME_TAB)}>
				<img src={resourceUrl('IconTray@2x.png')} className="tab-icon" alt="LibreRambox" />
			</div>
			<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
				<SortableContext items={items} strategy={vertical ? verticalListSortingStrategy : horizontalListSortingStrategy}>
					{items.map((id) =>
						id === SPACER ? (
							<Spacer key={SPACER} />
						) : (
							<ServiceTab
								key={id}
								service={services.find((s) => s.id === id)!}
								active={activeTab === id}
								onContextMenu={(e) => {
									e.preventDefault();
									setMenu({ serviceId: id, x: e.clientX, y: e.clientY });
								}}
							/>
						),
					)}
				</SortableContext>
			</DndContext>
			{menu && <TabContextMenu {...menu} onClose={() => setMenu(null)} />}
		</div>
	);
}

function Spacer() {
	// Takes part in sorting (it splits left from right) but can't be dragged itself
	const { setNodeRef } = useSortable({ id: SPACER, disabled: { draggable: true, droppable: false } });
	return <div ref={setNodeRef} className="tab-spacer" />;
}

function ServiceTab({ service, active, onContextMenu }: { service: Service; active: boolean; onContextMenu: (e: React.MouseEvent) => void }) {
	const badge = useApp((s) => s.badges[service.id]);
	const hibernated = useApp((s) => s.hibernated[service.id]);
	const teamIcon = useApp((s) => s.tabIcons[service.id]);
	const hideLabels = useUi((s) => s.config.hide_tabbar_labels);
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: service.id });

	const title = hideLabels || !service.tabname ? '' : service.name;

	return (
		<div
			ref={setNodeRef}
			{...attributes}
			{...listeners}
			className={'tab' + (active ? ' active' : '') + (hibernated ? ' hibernated' : '')}
			style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 10 : undefined }}
			title={service.name}
			onClick={() => activateTab(service.id)}
			onContextMenu={onContextMenu}
		>
			<span className="tab-icon-wrap">
				{teamIcon ? (
					<>
						<img src={teamIcon} className="tab-icon" alt="" />
						<img src={serviceIcon(service)} className="tab-icon-overlay" alt="" />
					</>
				) : (
					<img src={serviceIcon(service)} className="tab-icon" alt="" />
				)}
			</span>
			{title && <span className="tab-title">{title}</span>}
			{badge && <span className="tab-badge">{badge}</span>}
		</div>
	);
}

function TabContextMenu({ serviceId, x, y, onClose }: ContextMenuState & { onClose: () => void }) {
	const handle = registry.get(serviceId);
	const hibernated = useApp((s) => !!s.hibernated[serviceId]);
	if ( !handle ) return null;
	const run = (fn: () => void) => () => {
		fn();
		onClose();
	};

	return (
		<Menu opened onClose={onClose} position="bottom-start" withinPortal shadow="md" width={200}>
			<Menu.Target>
				<div style={{ position: 'fixed', left: x, top: y, width: 1, height: 1 }} />
			</Menu.Target>
			<Menu.Dropdown>
				<Button.Group mb={4}>
					<Button variant="default" size="xs" flex={1} leftSection={<IconChevronLeft size={14} />} onClick={run(handle.goBack)}>Back</Button>
					<Button variant="default" size="xs" flex={1} rightSection={<IconChevronRight size={14} />} onClick={run(handle.goForward)}>Forward</Button>
				</Button.Group>
				<Menu.Divider />
				<Menu.Item leftSection={<IconZoomIn size={14} />} onClick={handle.zoomIn}>Zoom In</Menu.Item>
				<Menu.Item leftSection={<IconZoomOut size={14} />} onClick={handle.zoomOut}>Zoom Out</Menu.Item>
				<Menu.Item leftSection={<IconZoomReset size={14} />} onClick={handle.resetZoom}>Reset Zoom</Menu.Item>
				<Menu.Divider />
				<Menu.Item leftSection={<IconRefresh size={14} />} onClick={handle.reload}>{t('app.webview[0]')}</Menu.Item>
				{hibernated ? (
					<Menu.Item leftSection={<IconSun size={14} />} onClick={handle.toggleHibernation}>{t('app.hibernation[11]')}</Menu.Item>
				) : (
					<Menu.Item leftSection={<IconMoon size={14} />} onClick={handle.toggleHibernation}>{t('app.hibernation[10]')}</Menu.Item>
				)}
				<Menu.Divider />
				<Menu.Item leftSection={<IconCode size={14} />} onClick={handle.toggleDevTools}>{t('app.webview[3]')}</Menu.Item>
			</Menu.Dropdown>
		</Menu>
	);
}
