import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadServices, nextServiceId, removeService, saveService } from './persistence';

// localStorage as written by the former Ext JS localstorage proxy
const EXT_FIXTURE: Record<string, string> = {
	services: '1,3',
	'services-counter': '3',
	'services-1': JSON.stringify({ position: 1, type: 'whatsapp', logo: 'whatsapp.png', name: 'WhatsApp', url: 'https://web.whatsapp.com/', align: 'left', notifications: true, muted: false, tabname: true, statusbar: true, displayTabUnreadCounter: true, includeInGlobalUnreadCounter: true, trust: false, enabled: true, js_unread: '', zoomLevel: 0.5 }),
	// Older record: hibernation fields did not exist yet
	'services-3': JSON.stringify({ position: 2, type: 'slack', logo: 'slack.png', name: 'Work', url: 'https://acme.slack.com/', align: 'right', notifications: false, muted: true, tabname: true, statusbar: false, enabled: false, js_unread: 'x()', zoomLevel: 0 }),
};

function fill(storage: Storage, data: Record<string, string>) {
	storage.clear();
	for ( const [key, value] of Object.entries(data) ) storage.setItem(key, value);
}

describe('persistence (Ext localstorage proxy format)', () => {
	beforeEach(() => fill(localStorage, EXT_FIXTURE));

	it('reads records written by Ext JS, applying defaults for missing fields', () => {
		const services = loadServices();
		expect(services.map((s) => s.id)).toEqual([1, 3]);
		expect(services[0]).toMatchObject({ id: 1, type: 'whatsapp', name: 'WhatsApp', zoomLevel: 0.5, hibernate: false, hibernateAfter: 15 });
		expect(services[1]).toMatchObject({ id: 3, align: 'right', enabled: false, muted: true, notifications: false, displayTabUnreadCounter: true, hibernateOnSelect: 'auto' });
	});

	it('writes records the way Ext JS did: no id inside, id list kept', () => {
		const [service] = loadServices();
		saveService({ ...service, name: 'Renamed' });
		const raw = JSON.parse(localStorage.getItem('services-1')!);
		expect(raw.id).toBeUndefined();
		expect(raw.name).toBe('Renamed');
		expect(localStorage.getItem('services')).toBe('1,3');
	});

	it('hands out ids after the stored counter and appends them to the id list', () => {
		const id = nextServiceId();
		expect(id).toBe(4);
		expect(localStorage.getItem('services-counter')).toBe('4');
		saveService({ ...loadServices()[0], id });
		expect(localStorage.getItem('services')).toBe('1,3,4');
	});

	it('removes the record and its id', () => {
		removeService(1);
		expect(localStorage.getItem('services-1')).toBeNull();
		expect(localStorage.getItem('services')).toBe('3');
		removeService(3);
		expect(localStorage.getItem('services')).toBeNull();
	});

	it('skips ids without a record', () => {
		localStorage.setItem('services', '1,3,9');
		expect(loadServices().map((s) => s.id)).toEqual([1, 3]);
	});
});

describe('services store', () => {
	beforeEach(() => {
		fill(localStorage, EXT_FIXTURE);
		vi.resetModules();
	});

	it('reorders tabs across the spacer and keeps the former position numbering', async () => {
		const { useServices, tabOrder } = await import('./services');
		const store = useServices.getState();
		store.load();
		store.update(3, { enabled: true });
		const added = useServices.getState().add({ ...useServices.getState().services[0], name: 'Second', align: 'left' });

		let { left, right } = tabOrder(useServices.getState().services);
		expect(left.map((s) => s.id)).toEqual([1, added.id]);
		expect(right.map((s) => s.id)).toEqual([3]);

		useServices.getState().reorder([added.id], [3, 1]);
		({ left, right } = tabOrder(useServices.getState().services));
		expect(left.map((s) => [s.id, s.position])).toEqual([[added.id, 1]]);
		expect(right.map((s) => [s.id, s.position, s.align])).toEqual([[3, 2, 'right'], [1, 3, 'right']]);
		expect(JSON.parse(localStorage.getItem('services-1')!)).toMatchObject({ align: 'right', position: 3 });
	});

	it('puts a re-enabled service back at its old place', async () => {
		const { useServices, tabOrder } = await import('./services');
		useServices.getState().load();
		useServices.getState().update(3, { enabled: true, align: 'left' });
		useServices.getState().update(1, { enabled: false });
		useServices.getState().update(1, { enabled: true });
		const { left } = tabOrder(useServices.getState().services);
		expect(left.map((s) => s.id)).toEqual([1, 3]);
	});
});
