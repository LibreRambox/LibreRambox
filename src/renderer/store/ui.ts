import { create } from 'zustand';
import type { CatalogEntry, Service } from './types';
import { getConfig, type AppConfig } from '../config';

export type ServiceDialogState =
	| { mode: 'add'; entry: CatalogEntry }
	| { mode: 'edit'; service: Service; entry: CatalogEntry | undefined };

interface UiState {
	// Config values the UI renders from (tab bar location, labels...), refreshed after saving preferences
	config: AppConfig;
	serviceDialog: ServiceDialogState | null;
	preferencesOpen: boolean;
	aboutOpen: boolean;
	refreshConfig: () => void;
	openServiceDialog: (state: ServiceDialogState) => void;
	closeServiceDialog: () => void;
	setPreferencesOpen: (open: boolean) => void;
	setAboutOpen: (open: boolean) => void;
}

export const useUi = create<UiState>((set) => ({
	config: getConfig(),
	serviceDialog: null,
	preferencesOpen: false,
	aboutOpen: false,
	refreshConfig: () => set({ config: getConfig() }),
	openServiceDialog: (serviceDialog) => set({ serviceDialog }),
	closeServiceDialog: () => set({ serviceDialog: null }),
	setPreferencesOpen: (preferencesOpen) => set({ preferencesOpen }),
	setAboutOpen: (aboutOpen) => set({ aboutOpen }),
}));
