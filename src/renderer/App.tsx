import { useEffect, useMemo } from 'react';
import { HOME_TAB, totalUnread, useApp } from './store/app';
import { useCatalog } from './store/catalog';
import { useServices } from './store/services';
import { useUi } from './store/ui';
import { activateTab } from './actions';
import { formatNumber } from './util/format';
import { useIpcHandlers } from './hooks/useIpcHandlers';
import { useShortcuts } from './hooks/useShortcuts';
import { checkConnection, checkMacPermissions, initDontDisturb, selectDefaultTab, showServicesNotLoaded } from './startup';
import { TabBar } from './components/TabBar';
import { ServiceView } from './components/ServiceView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HomeTab } from './components/home/HomeTab';
import { Banners } from './components/Banners';
import { ServiceDialog } from './components/dialogs/ServiceDialog';
import { Preferences } from './components/dialogs/Preferences';
import { About } from './components/dialogs/About';
import { LockScreen } from './components/dialogs/LockScreen';

export function App() {
	const services = useServices((s) => s.services);
	const activeTab = useApp((s) => s.activeTab);
	const unread = useApp((s) => s.unread);
	const tabbarLocation = useUi((s) => s.config.tabbar_location);
	const catalogLoaded = useCatalog((s) => s.loaded);

	useIpcHandlers();
	useShortcuts();

	useEffect(() => {
		checkConnection();
		checkMacPermissions();
		initDontDisturb();
		useCatalog.getState().load().then(() => {
			document.getElementById('spinner')?.remove();
			document.getElementById('background')?.remove();
			if ( useCatalog.getState().failed ) showServicesNotLoaded();
			useServices.getState().load();
			selectDefaultTab();
		});
	}, []);

	// The active service was disabled or removed
	const enabled = useMemo(() => services.filter((s) => s.enabled), [services]);
	useEffect(() => {
		if ( activeTab !== HOME_TAB && !enabled.some((s) => s.id === activeTab) ) activateTab(HOME_TAB);
	}, [activeTab, enabled]);

	// Window title with the global unread count; the main process reads it for the dock/tray badge
	const total = totalUnread(unread);
	const activeName = activeTab === HOME_TAB ? null : services.find((s) => s.id === activeTab)?.name;
	useEffect(() => {
		document.title = 'LibreRambox' + (total > 0 ? ' (' + formatNumber(total) + ')' : '') + (activeName ? ' - ' + activeName : '');
	}, [total, activeName]);

	const vertical = tabbarLocation === 'left' || tabbarLocation === 'right';

	return (
		<div className={'app tabbar-' + tabbarLocation}>
			<Banners />
			<div className="app-main">
				<TabBar vertical={vertical} />
				<div className="tab-content">
					<div className={'tab-pane' + (activeTab === HOME_TAB ? ' active' : '')}>
						<HomeTab />
					</div>
					{/* Sorted by id, never by tab order: moving a <webview> in the DOM reloads it */}
					{catalogLoaded && [...enabled].sort((a, b) => a.id - b.id).map((service) => (
						<div key={service.id} className={'tab-pane' + (activeTab === service.id ? ' active' : '')}>
							<ErrorBoundary name={service.name}>
								<ServiceView service={service} active={activeTab === service.id} />
							</ErrorBoundary>
						</div>
					))}
				</div>
			</div>
			<ServiceDialog />
			<Preferences />
			<About />
			<LockScreen />
		</div>
	);
}
