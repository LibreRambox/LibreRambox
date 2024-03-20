/**
 * Singleton class to handle the global unread counter.
 */
Ext.define('LibreRambox.util.UnreadCounter', {

	singleton: true,

	constructor: function(config) {

		config = config || {};

		/**
		 * Map for storing the global unread count.
		 * service id -> unread count
		 *
		 * @type {Map}
		 */
		var unreadCountByService = new Map();

		/**
		 * Holds the global unread count for internal usage.
		 *
		 * @type {number}
		 */
		var totalUnreadCount = 0;

		/**
		 * Sets the application's unread count to tracked unread count.
		 */
		function updateAppUnreadCounter() {
			LibreRambox.app.setTotalNotifications(totalUnreadCount);
		}

		/**
		 * Returns the global unread count.
		 *
		 * @return {number}
		 */
		this.getTotalUnreadCount = function() {
			return totalUnreadCount;
		};

		/**
		 * Sets the global unread count for a specific service.
		 *
		 * @param {*} id				Id of the service to set the global unread count for.
		 * @param {number} unreadCount	The global unread count for the service.
		 */
		this.setUnreadCountForService = function(id, unreadCount) {
			unreadCount = parseInt(unreadCount, 10);

			if (unreadCountByService.has(id)) {
				totalUnreadCount -= unreadCountByService.get(id);
			}
			totalUnreadCount += unreadCount;
			unreadCountByService.set(id, unreadCount);

			updateAppUnreadCounter();
		};

		/**
		 * Clears the global unread count for a specific service.
		 *
		 * @param {*} id	Id of the service to clear the global unread count for.
		 */
		this.clearUnreadCountForService = function(id) {
			if (unreadCountByService.has(id)) {
				totalUnreadCount -= unreadCountByService.get(id);
			}
			unreadCountByService['delete'](id);

			updateAppUnreadCounter();
		}
	}
});
