import { create } from 'zustand';
import type { CatalogEntry } from './types';
import { resourceUrl } from '../electron';
import { t } from '../i18n';

interface CatalogState {
	entries: CatalogEntry[];
	loaded: boolean;
	failed: boolean;
	load: () => Promise<void>;
}

const entryDefaults = (): Omit<CatalogEntry, 'id' | 'logo' | 'name' | 'url' | 'type'> => ({
	description: t('services[27]'),
	js_unread: '',
	js_unread_iframes: false,
	titleBlink: false,
	allow_popups: false,
	manual_notifications: false,
	userAgent: '',
	note: '',
	custom_domain: false,
});

export const CUSTOM_SERVICE_ID = 'custom';

export const useCatalog = create<CatalogState>((set) => ({
	entries: [],
	loaded: false,
	failed: false,
	load: async () => {
		let entries: CatalogEntry[] = [];
		let failed = false;
		try {
			const response = await fetch(resourceUrl('services.json'));
			const json = await response.json();
			entries = (json.responseText ?? json).map((entry: Partial<CatalogEntry>) => ({ ...entryDefaults(), ...entry }));
		} catch ( err ) {
			console.error('Services could not be loaded', err);
			failed = true;
		}
		entries.push({
			...entryDefaults(),
			id: CUSTOM_SERVICE_ID,
			logo: 'custom.png',
			name: '_Custom Service',
			description: t('services[38]'),
			url: '___',
			type: 'custom',
			allow_popups: true,
		});
		// Plain code point order, like the former Ext sorter ("_Custom Service" ends up after the capitalized names)
		entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
		set({ entries, loaded: true, failed });
	},
}));

export const getCatalogEntry = (id: string) => useCatalog.getState().entries.find((e) => e.id === id);
