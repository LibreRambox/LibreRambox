import { create } from 'zustand';
import type { Service, ServiceInput } from './types';
import * as persistence from './persistence';

interface ServicesState {
	services: Service[];
	load: () => void;
	add: (input: ServiceInput) => Service;
	update: (id: number, patch: Partial<Service>) => void;
	remove: (id: number) => void;
	// Applies a new tab order: sets align and position of the enabled services
	reorder: (leftIds: number[], rightIds: number[]) => void;
}

const byPosition = (a: Service, b: Service) => a.position - b.position || a.id - b.id;

// Enabled services as they appear in the tab bar
export function tabOrder(services: Service[]): { left: Service[]; right: Service[] } {
	const enabled = services.filter((s) => s.enabled).sort(byPosition);
	return {
		left: enabled.filter((s) => s.align === 'left'),
		right: enabled.filter((s) => s.align === 'right'),
	};
}

// Positions follow the former tab panel indexes: the home tab is 0, then left services,
// then right services (the spacer between them does not count)
function applyOrder(services: Service[], leftIds: number[], rightIds: number[]): Service[] {
	const changes = new Map<number, Partial<Service>>();
	leftIds.forEach((id, i) => changes.set(id, { align: 'left', position: i + 1 }));
	rightIds.forEach((id, i) => changes.set(id, { align: 'right', position: leftIds.length + i + 1 }));
	return services.map((s) => {
		const change = changes.get(s.id);
		if ( !change || (change.align === s.align && change.position === s.position) ) return s;
		const updated = { ...s, ...change };
		persistence.saveService(updated);
		return updated;
	});
}

export const useServices = create<ServicesState>((set, get) => ({
	services: [],

	load: () => {
		const services = persistence.loadServices().map((service) => {
			// Rebranded app
			if ( service.type !== 'spark' ) return service;
			const updated = { ...service, type: 'webexteams', logo: 'webexteams.png' };
			persistence.saveService(updated);
			return updated;
		});
		set({ services: services.sort(byPosition) });
	},

	add: (input) => {
		const service: Service = { ...persistence.SERVICE_DEFAULTS, ...input, id: persistence.nextServiceId(), position: 0 };
		persistence.saveService(service);
		const services = [...get().services, service];
		const { left, right } = tabOrder(get().services);
		const leftIds = left.map((s) => s.id);
		const rightIds = right.map((s) => s.id);
		(service.align === 'left' ? leftIds : rightIds).push(service.id);
		set({ services: applyOrder(services, leftIds, rightIds) });
		return get().services.find((s) => s.id === service.id)!;
	},

	update: (id, patch) => {
		const previous = get().services.find((s) => s.id === id);
		if ( !previous ) return;
		const service: Service = { ...previous, ...patch, id };
		persistence.saveService(service);
		const services = get().services.map((s) => (s.id === id ? service : s));

		const moved = service.align !== previous.align;
		const toggled = service.enabled !== previous.enabled;
		if ( !moved && !toggled ) return set({ services });

		// Recompute the tab order: a service moved to the other side goes to its end,
		// a re-enabled service goes back to where it was before being disabled
		const { left, right } = tabOrder(services.filter((s) => s.id !== id));
		const leftIds = left.map((s) => s.id);
		const rightIds = right.map((s) => s.id);
		if ( service.enabled ) {
			const side = service.align === 'left' ? left : right;
			const ids = service.align === 'left' ? leftIds : rightIds;
			const index = moved ? -1 : side.findIndex((s) => s.position >= service.position);
			ids.splice(index === -1 ? ids.length : index, 0, id);
		}
		set({ services: applyOrder(services, leftIds, rightIds) });
	},

	remove: (id) => {
		persistence.removeService(id);
		set({ services: get().services.filter((s) => s.id !== id) });
	},

	reorder: (leftIds, rightIds) => {
		set({ services: applyOrder(get().services, leftIds, rightIds) });
	},
}));

export const getService = (id: number) => useServices.getState().services.find((s) => s.id === id);
