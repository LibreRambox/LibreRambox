import { ipc } from './electron';

// Shape of the electron-store config (see electron/main.mjs defaults)
export interface AppConfig {
	locale: string;
	auto_launch: boolean;
	start_minimized: boolean;
	hide_menu_bar: boolean;
	tabbar_location: 'top' | 'left' | 'bottom' | 'right';
	hide_tabbar_labels: boolean;
	default_service: string | number;
	window_display_behavior: 'show_taskbar' | 'show_trayIcon' | 'taskbar_tray';
	window_close_behavior: 'keep_in_tray' | 'keep_in_tray_and_taskbar' | 'quit';
	always_on_top: boolean;
	systemtray_indicator: boolean;
	flash_frame: boolean;
	disable_gpu: boolean;
	enable_hidpi_support: boolean;
	user_agent: string;
	master_password: string | false;
	proxy: boolean;
	proxyHost: string;
	proxyPort: string | number;
	proxyLogin: string;
	proxyPassword: string;
	hideNoConnectionDialog?: boolean;
	[key: string]: unknown;
}

export function getConfig(): AppConfig {
	return ipc.sendSync('getConfig');
}

// Saves values and lets the main process apply them (menu bar, tray, auto launch...)
export function setConfig(values: Partial<AppConfig>): void {
	ipc.send('setConfig', values);
}

// Saves values without side effects in the main process
export function storeConfig(values: Partial<AppConfig>): void {
	ipc.send('sConfig', values);
}
