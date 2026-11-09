// Node and Electron modules are reached through the nodeIntegration `require`,
// so Vite leaves them out of the bundle.
import type * as ElectronNS from 'electron';

declare global {
	interface Window {
		require: NodeJS.Require;
		ipc: ElectronNS.IpcRenderer;
		locale: Record<string, string>;
	}
}

const nodeRequire: NodeJS.Require = typeof window !== 'undefined' && window.require ? window.require : (() => { throw new Error('Node integration is not available'); }) as unknown as NodeJS.Require;

export const electron: typeof ElectronNS = nodeRequire('electron');
export const ipc = electron.ipcRenderer;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const remote: any = nodeRequire('@electron/remote');
export const platform: NodeJS.Platform = process.platform;
const nodeUrl: typeof import('url') = nodeRequire('url');
const nodePath: typeof import('path') = nodeRequire('path');

// The main process (tray.js) runs `ipc.send(...)` in this page through executeJavaScript
window.ipc = ipc;

// URL of a file in /resources. The built page lives in build/renderer/, the dev server serves
// the repo root; '../../resources/' resolves correctly in both cases.
export function resourceUrl(path: string): string {
	return new URL('../../resources/' + path, document.baseURI).href;
}

// <webview preload> needs a file: URL, also while the page is served by the dev server
export function resourceFileUrl(path: string): string {
	return nodeUrl.pathToFileURL(nodePath.join(remote.app.getAppPath(), 'resources', path)).href;
}
