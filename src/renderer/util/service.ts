import type { Service, CatalogEntry } from '../store/types';
import { remote, resourceUrl } from '../electron';
import { getConfig } from '../config';

// Must stay exactly as before: the partition holds the cookies/logins of the service
export function partitionFor(service: Pick<Service, 'id' | 'type'>): string {
	let suffix = '';
	if ( localStorage.getItem('id_token') ) {
		try {
			suffix = '_' + JSON.parse(localStorage.getItem('profile') || '{}').sub;
		} catch ( err ) {
			console.error('Invalid profile in localStorage', err);
		}
	}
	return 'persist:' + service.type + '_' + service.id + suffix;
}

export function serviceIcon(service: Pick<Service, 'type' | 'logo'>): string {
	if ( service.type !== 'custom' ) return resourceUrl('icons/' + service.logo);
	return service.logo === '' ? resourceUrl('icons/custom.png') : service.logo;
}

// Google rejects logins when the page sees a Chrome UA that isn't real Chrome, keeping the Electron token gets past that
const isGoogleService = (entry: CatalogEntry | undefined) => /^https?:\/\/[^/]*\.google\.com(\/|$)/.test(entry?.url ?? '');

export function userAgentFor(entry: CatalogEntry | undefined): string {
	const ua = getConfig().user_agent || entry?.userAgent || '';
	if ( ua.length > 0 ) return ua;
	const defaultUa = navigator.userAgent.replace(/LibreRambox\/\S+\s/gi, '');
	return isGoogleService(entry) ? defaultUa : defaultUa.replace(/Electron\/\S+\s/gi, '');
}

// Clears cookies, cache and storage of a service. Works on the partition directly,
// so disabled or hibernated services don't need to be loaded first.
export async function clearServiceData(service: Pick<Service, 'id' | 'type'>): Promise<void> {
	const session = remote.session.fromPartition(partitionFor(service));
	session.flushStorageData();
	await session.clearCache();
	await session.clearStorageData();
	await session.cookies.flushStore();
}
