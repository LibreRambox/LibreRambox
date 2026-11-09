// The stores read the Electron config on import; tests run without Electron
window.require = ((name: string) => {
	if ( name === 'electron' ) return { ipcRenderer: { sendSync: () => ({ locale: 'en', tabbar_location: 'top' }), send: () => {}, on: () => {} } };
	if ( name === '@electron/remote' ) return { app: { getAppPath: () => '/app' } };
	throw new Error('Unexpected require ' + name);
}) as unknown as NodeJS.Require;

// Node's own (file backed) Web Storage global shadows the jsdom one; use a fresh in-memory Storage
class MemoryStorage implements Storage {
	private data = new Map<string, string>();
	get length() { return this.data.size; }
	clear() { this.data.clear(); }
	getItem(key: string) { return this.data.has(key) ? this.data.get(key)! : null; }
	key(index: number) { return [...this.data.keys()][index] ?? null; }
	removeItem(key: string) { this.data.delete(key); }
	setItem(key: string, value: string) { this.data.set(key, String(value)); }
}
Object.defineProperty(globalThis, 'localStorage', { value: new MemoryStorage(), configurable: true });
