import type { WebviewTag } from 'electron';

// Imperative API of a mounted ServiceView, used by menus, IPC handlers and shortcuts
export interface ServiceHandle {
	reload(): void;
	goBack(): void;
	goForward(): void;
	zoomIn(): void;
	zoomOut(): void;
	resetZoom(): void;
	showSearch(visible: boolean): void;
	toggleDevTools(): void;
	toggleStatusBar(): void;
	toggleHibernation(): void;
	isHibernated(): boolean;
	getWebView(): WebviewTag | null;
	focus(): void;
}

const handles = new Map<number, ServiceHandle>();

export const registry = {
	register(id: number, handle: ServiceHandle) {
		handles.set(id, handle);
	},
	unregister(id: number, handle: ServiceHandle) {
		if ( handles.get(id) === handle ) handles.delete(id);
	},
	get(id: number): ServiceHandle | undefined {
		return handles.get(id);
	},
};
