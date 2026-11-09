import { useEffect } from 'react';
import Mousetrap from 'mousetrap';
import { platform } from '../electron';
import { HOME_TAB, useApp } from '../store/app';
import { activateTab, activateTabAt, activeHandle, cycleTab, lockLibreRambox, toggleDontDisturb } from '../actions';

export function useShortcuts() {
	useEffect(() => {
		const mac = platform === 'darwin';
		// Shortcuts also work while typing in text fields
		Mousetrap.prototype.stopCallback = () => false;

		// Switch services using CTRL + Number
		Mousetrap.bind([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (mac ? 'command+' : 'ctrl+') + n), (e) => {
			activateTabAt(parseInt(e.key, 10));
		});
		// Main tab
		Mousetrap.bind(mac ? 'command+,' : 'ctrl+,', () => activateTab(HOME_TAB));
		// Navigate through services
		Mousetrap.bind(['ctrl+tab', 'ctrl+pagedown'], () => cycleTab(1));
		Mousetrap.bind(['ctrl+shift+tab', 'ctrl+pageup'], () => cycleTab(-1));
		// Search inside a service
		Mousetrap.bind(mac ? 'command+alt+f' : 'shift+alt+f', () => activeHandle()?.showSearch(true));
		// Do Not Disturb
		Mousetrap.bind(mac ? 'command+alt+d' : 'shift+alt+d', () => toggleDontDisturb());
		// Lock LibreRambox
		Mousetrap.bind(mac ? 'command+alt+l' : 'shift+alt+l', () => {
			if ( !useApp.getState().locked ) lockLibreRambox();
		});

		// Mouse wheel zooming
		const onWheel = (e: WheelEvent) => {
			if ( !e.ctrlKey ) return;
			const handle = activeHandle();
			if ( !handle ) return;
			e.deltaY < 0 ? handle.zoomIn() : handle.zoomOut();
		};
		document.addEventListener('wheel', onWheel);

		// Focus the current service when Alt + Tab or click in webviews textfields
		const onFocus = () => activeHandle()?.focus();
		window.addEventListener('focus', onFocus);

		return () => {
			Mousetrap.reset();
			document.removeEventListener('wheel', onWheel);
			window.removeEventListener('focus', onFocus);
		};
	}, []);
}
