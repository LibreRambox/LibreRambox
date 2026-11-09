import type { Service, CatalogEntry } from '../store/types';
import { ipc } from '../electron';
import { activateTab } from '../actions';
import { plural } from './format';
import { serviceIcon } from './service';

// Notification for services that can't notify on their own (catalog flag "manual_notifications")
export function dispatchNotification(service: Service, entry: CatalogEntry | undefined, count: number) {
	let text: string;
	switch ( entry?.type ) {
		case 'messaging':
			text = 'You have ' + plural(count, 'new message', 'new messages') + '.';
			break;
		case 'email':
			text = 'You have ' + plural(count, 'new email', 'new emails') + '.';
			break;
		default:
			text = 'You have ' + plural(count, 'new activity', 'new activities') + '.';
			break;
	}

	const notification = new Notification(service.name, {
		body: text,
		icon: serviceIcon(service),
		silent: service.muted,
	});

	notification.onclick = () => {
		ipc.send('toggleWin', true);
		activateTab(service.id);
	};
}
