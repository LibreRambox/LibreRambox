/**
 * This file is loaded in the service web views to provide a LibreRambox API.
 */

const { desktopCapturer, ipcRenderer } = require('electron');

// In sandboxed webview preloads `desktopCapturer` is not whitelisted in the
// electron module. Guard so the preload keeps working everywhere else.
const screenshareSupported = typeof desktopCapturer !== 'undefined';

/**
 * Make the LibreRambox API available via a global "librerambox" variable.
 *
 * @type {{}}
 */
window.librerambox = {};

/**
 * Sets the unread count of the tab.
 *
 * @param {*} count	The unread count
 */
window.librerambox.setUnreadCount = function(count) {
	ipcRenderer.sendToHost('librerambox.setUnreadCount', count);
};

/**
 * Clears the unread count.
 */
window.librerambox.clearUnreadCount = function() {
	ipcRenderer.sendToHost('librerambox.clearUnreadCount');
}

/**
 * Deprecated alias for js_unread scripts saved before the namespace change
 * (e.g. in custom services defined with older versions).
 */
window.rambox = window.librerambox;

/**
 * Override to add notification click event to display LibreRambox window and activate service tab
 */
var NativeNotification = Notification;
Notification = function(title, options) {
	var notification = new NativeNotification(title, options);

	notification.addEventListener('click', function() {
		ipcRenderer.sendToHost('librerambox.showWindowAndActivateTab');
	});

	//It seems that gmail is checking if such event handler func are available. Just remplacing them by a void function that is always returning true is making the thing right!
	notification.addEventListener = function() {return true};
	notification.attachEvent = function() {return true};
	notification.addListener = function() {return true};

	return notification;
}

Notification.prototype = NativeNotification.prototype;
Notification.permission = NativeNotification.permission;
Notification.requestPermission = NativeNotification.requestPermission.bind(Notification);

// Navigation shortcuts inside services. Replaces the `mousetrap` module,
// which is not available in sandboxed webview preloads and used to break
// this whole preload script (and with it the ScreenShare hook below).
document.addEventListener('keydown', e => {
	if ( location.href.indexOf('slack.com') !== -1 ) return;
	const modifier = process.platform === 'darwin' ? e.metaKey : e.altKey;
	if ( !modifier || e.shiftKey || e.ctrlKey ) return;
	if ( e.key === 'ArrowLeft' ) history.back();
	else if ( e.key === 'ArrowRight' ) history.forward();
});

// ScreenShare
if ( window.navigator.mediaDevices ) window.navigator.mediaDevices.getDisplayMedia = () =>
  new Promise(async (resolve, reject) => {
    if ( !screenshareSupported ) {
      reject(new Error('Screen sharing is not available in this context'));
      return;
    }
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
      });

      const unlisten = () => {
        ipcRenderer.removeAllListeners('screenShare:cancel');
        ipcRenderer.removeAllListeners('screenShare:share');
      };

      ipcRenderer.on('screenShare:cancel', () => {
        unlisten();
        reject(new Error('Cancelled by user'));
      });

      ipcRenderer.on('screenShare:share', (_, shareId) => {
        unlisten();
        window.navigator.mediaDevices
          .getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: shareId,
              },
            },
          })
          .then(stream => resolve(stream));
      });

      const mappedSources = sources.map(it => ({
        id: it.id,
        name: it.name,
        thumbnail: it.thumbnail.toDataURL(),
      }));

      ipcRenderer.send('screenShare:show', mappedSources);
    } catch (err) {
      reject(err);
    }
  });
