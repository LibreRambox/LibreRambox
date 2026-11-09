import { create } from 'zustand';

export const HOME_TAB = 'libreRamboxTab';
export type TabId = typeof HOME_TAB | number;

export interface Banner {
	id: string;
	content: React.ReactNode;
	color?: string;
}

interface AppState {
	activeTab: TabId;
	// Badge text shown on each service tab
	badges: Record<number, string>;
	// Unread count per service included in the global counter (former LibreRambox.util.UnreadCounter)
	unread: Record<number, number>;
	hibernated: Record<number, boolean>;
	// Team icon of services that provide one (e.g. Slack), see util/iconLoader
	tabIcons: Record<number, string>;
	dontDisturb: boolean;
	locked: boolean;
	banners: Banner[];

	setActiveTab: (tab: TabId) => void;
	setBadge: (id: number, text: string) => void;
	setUnread: (id: number, count: number | null) => void;
	setHibernated: (id: number, hibernated: boolean) => void;
	setTabIcon: (id: number, url: string) => void;
	forgetService: (id: number) => void;
	setDontDisturb: (value: boolean) => void;
	setLocked: (value: boolean) => void;
	showBanner: (banner: Banner) => void;
	closeBanner: (id: string) => void;
}

const omit = <T,>(record: Record<number, T>, id: number) => {
	const { [id]: _removed, ...rest } = record;
	return rest;
};

export const useApp = create<AppState>((set) => ({
	activeTab: HOME_TAB,
	badges: {},
	unread: {},
	hibernated: {},
	tabIcons: {},
	dontDisturb: JSON.parse(localStorage.getItem('dontDisturb') || 'false'),
	locked: !!localStorage.getItem('locked'),
	banners: [],

	setActiveTab: (activeTab) => set({ activeTab }),
	setBadge: (id, text) => set((s) => ({ badges: { ...s.badges, [id]: text } })),
	setUnread: (id, count) => set((s) => ({ unread: count === null ? omit(s.unread, id) : { ...s.unread, [id]: count } })),
	setHibernated: (id, value) => set((s) => ({ hibernated: { ...s.hibernated, [id]: value } })),
	setTabIcon: (id, url) => set((s) => ({ tabIcons: { ...s.tabIcons, [id]: url } })),
	forgetService: (id) => set((s) => ({
		badges: omit(s.badges, id),
		unread: omit(s.unread, id),
		hibernated: omit(s.hibernated, id),
		tabIcons: omit(s.tabIcons, id),
	})),
	setDontDisturb: (dontDisturb) => set({ dontDisturb }),
	setLocked: (locked) => set({ locked }),
	// A banner replaces any previous banner with the same id
	showBanner: (banner) => set((s) => ({ banners: [...s.banners.filter((b) => b.id !== banner.id), banner] })),
	closeBanner: (id) => set((s) => ({ banners: s.banners.filter((b) => b.id !== id) })),
}));

export const totalUnread = (unread: Record<number, number>) => Object.values(unread).reduce((sum, n) => sum + n, 0);
