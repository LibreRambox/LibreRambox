// A configured service, as stored in localStorage (fields of the former Ext model LibreRambox.model.Service)
export interface Service {
	id: number;
	position: number;
	type: string;
	logo: string;
	name: string;
	url: string;
	align: 'left' | 'right';
	notifications: boolean;
	muted: boolean;
	tabname: boolean;
	statusbar: boolean;
	displayTabUnreadCounter: boolean;
	includeInGlobalUnreadCounter: boolean;
	trust: boolean;
	enabled: boolean;
	js_unread: string;
	zoomLevel: number;
	disableAutoReloadOnFail: boolean;
	// Hibernation: unload the service when it has not been used for a while to save RAM
	hibernate: boolean;
	hibernateAfter: number; // minutes in background before hibernating
	hibernateOnSelect: 'auto' | 'ask'; // 'auto' = wake up when the tab is selected, 'ask' = show a "Wake up now" button
	hibernateRewake: boolean; // periodically wake up in background to check for new messages
	hibernateRewakeEvery: number; // minutes between background wake-ups
	hibernateRewakeFor: number; // minutes to stay awake before hibernating again
}

export type ServiceInput = Omit<Service, 'id' | 'position'> & Partial<Pick<Service, 'position'>>;

// An entry of resources/services.json (former LibreRambox.model.ServiceList)
export interface CatalogEntry {
	id: string;
	logo: string;
	name: string;
	description: string;
	url: string;
	type: string; // 'messaging' | 'email' | 'custom'...
	js_unread: string;
	js_unread_iframes: boolean;
	titleBlink: boolean;
	allow_popups: boolean;
	manual_notifications: boolean;
	userAgent: string;
	note: string;
	custom_domain: boolean;
}
