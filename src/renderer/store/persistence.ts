import type { Service } from './types';

// Reads and writes services in the exact format of the former Ext JS `localstorage` proxy
// (id 'services'), so existing installs keep their services and older builds can still read them:
//   services          -> "1,2,5"         ids of all records
//   services-<id>     -> JSON            record without its id
//   services-counter  -> "5"             last id handed out
const PROXY_ID = 'services';
const recordKey = (id: number) => `${PROXY_ID}-${id}`;
const COUNTER_KEY = `${PROXY_ID}-counter`;

export const SERVICE_DEFAULTS: Omit<Service, 'id' | 'type' | 'name' | 'url'> = {
	position: 0,
	logo: '',
	align: 'left',
	notifications: true,
	muted: false,
	tabname: true,
	statusbar: true,
	displayTabUnreadCounter: true,
	includeInGlobalUnreadCounter: true,
	trust: false,
	enabled: true,
	js_unread: '',
	zoomLevel: 0,
	disableAutoReloadOnFail: false,
	hibernate: false,
	hibernateAfter: 15,
	hibernateOnSelect: 'auto',
	hibernateRewake: false,
	hibernateRewakeEvery: 15,
	hibernateRewakeFor: 1,
};

const FIELDS = ['position', 'type', 'name', 'url', ...Object.keys(SERVICE_DEFAULTS)] as (keyof Service)[];

// Ext field types converted values on read; do the same so old or hand-edited data keeps working
function normalize(id: number, raw: Record<string, unknown>): Service {
	const service = { ...SERVICE_DEFAULTS, type: '', name: '', url: '', id } as Service;
	for ( const field of FIELDS ) {
		const value = raw[field];
		if ( value === undefined || value === null ) continue;
		const fallback = (service as unknown as Record<string, unknown>)[field];
		let converted: unknown = value;
		if ( typeof fallback === 'boolean' ) converted = value === true || value === 'true' || value === 1;
		else if ( typeof fallback === 'number' ) {
			converted = field === 'zoomLevel' ? parseFloat(String(value)) : parseInt(String(value), 10);
			if ( Number.isNaN(converted) ) converted = fallback;
		} else converted = String(value);
		(service as unknown as Record<string, unknown>)[field] = converted;
	}
	if ( service.align !== 'right' ) service.align = 'left';
	if ( service.hibernateOnSelect !== 'ask' ) service.hibernateOnSelect = 'auto';
	return service;
}

function getIds(storage: Storage): number[] {
	const value = storage.getItem(PROXY_ID) || '';
	return value === '' ? [] : value.split(',').map(Number);
}

function setIds(storage: Storage, ids: number[]) {
	storage.removeItem(PROXY_ID);
	if ( ids.length ) storage.setItem(PROXY_ID, ids.join(','));
}

export function loadServices(storage: Storage = localStorage): Service[] {
	return getIds(storage).flatMap((id) => {
		const json = storage.getItem(recordKey(id));
		if ( !json ) return [];
		try {
			return [normalize(id, JSON.parse(json))];
		} catch ( err ) {
			console.error('Invalid service record', id, err);
			return [];
		}
	});
}

export function saveService(service: Service, storage: Storage = localStorage) {
	const data: Record<string, unknown> = {};
	for ( const field of FIELDS ) data[field] = service[field];
	storage.removeItem(recordKey(service.id));
	storage.setItem(recordKey(service.id), JSON.stringify(data));
	const ids = getIds(storage);
	if ( !ids.includes(service.id) ) setIds(storage, [...ids, service.id]);
}

export function removeService(id: number, storage: Storage = localStorage) {
	storage.removeItem(recordKey(id));
	setIds(storage, getIds(storage).filter((i) => i !== id));
}

// Same as Ext.data.identifier.Sequential seeded with services-counter + 1
export function nextServiceId(storage: Storage = localStorage): number {
	const lastId = +(storage.getItem(COUNTER_KEY) || 0);
	const maxId = Math.max(0, ...getIds(storage));
	const id = Math.max(lastId, maxId) + 1;
	storage.setItem(COUNTER_KEY, String(id));
	return id;
}
