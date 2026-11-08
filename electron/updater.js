const { app, ipcMain, BrowserWindow, net } = require('electron');
const { autoUpdater } = require("electron-updater");

// autoUpdater.logger = require("electron-log");
// autoUpdater.logger.transports.file.level = "debug";
// autoUpdater.currentVersion = '0.8.1';
// autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml');

const OWNER = 'LibreRambox';
const REPO = 'LibreRambox';
const RELEASES_API = `https://api.github.com/repos/${OWNER}/${REPO}/releases/latest`;
const releasePage = (version) => `https://github.com/${OWNER}/${REPO}/releases/tag/v${version}`;

const STARTUP_DELAY = 10 * 1000;            // give the UI time to load before the first check
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // re-check once a day while LibreRambox keeps running

autoUpdater.setFeedURL({
	"provider": "github",
	"owner": OWNER,
	"repo": REPO,
	"vPrefixedTagName": true
});

let mainWindow = null;
let checking = false;         // a check is in progress
let manual = false;           // the current check was started by the user (show "up to date" / errors)
let availableVersion = null;  // version found by electron-updater during the current check
let downloadedInfo = null;    // set once an update has been downloaded and is ready to install

const send = (channel, ...args) => {
	if ( mainWindow && !mainWindow.isDestroyed() ) mainWindow.webContents.send(channel, ...args);
};

// Compare two version strings ("1.2.3", "v1.2.3-beta.1"). Returns >0 if a is newer than b.
const compareVersions = (a, b) => {
	const parse = (v) => {
		const [main, pre] = String(v).trim().replace(/^v/i, '').split('-', 2);
		return { nums: main.split('.').map((n) => parseInt(n, 10) || 0), pre: pre || null };
	};
	const va = parse(a), vb = parse(b);
	for ( let i = 0; i < Math.max(va.nums.length, vb.nums.length); i++ ) {
		const diff = (va.nums[i] || 0) - (vb.nums[i] || 0);
		if ( diff !== 0 ) return diff;
	}
	if ( va.pre === vb.pre ) return 0;
	if ( va.pre === null ) return 1;  // 1.0.0 > 1.0.0-beta
	if ( vb.pre === null ) return -1;
	return va.pre.localeCompare(vb.pre, undefined, { numeric: true });
};

// Tell the user a newer version exists that has to be downloaded by hand
// (portable/snap/tar.gz builds, unsigned macOS builds, failed downloads, ...).
const notifyManualDownload = (version, url) => {
	send('autoUpdater:update-available-manual', { version, currentVersion: app.getVersion(), url: url || releasePage(version) });
};

// Ask the GitHub API directly for the latest release. Used when electron-updater
// can't handle this installation or its check failed.
const checkGitHubRelease = async () => {
	const response = await net.fetch(RELEASES_API, {
		headers: {
			 'Accept': 'application/vnd.github+json'
			,'User-Agent': `LibreRambox/${app.getVersion()}`
		}
	});
	if ( !response.ok ) throw new Error(`GitHub responded with status ${response.status}`);
	const release = await response.json();
	if ( !release || !release.tag_name ) throw new Error('GitHub returned no release information');
	return { version: release.tag_name.replace(/^v/i, ''), url: release.html_url };
};

const fallbackCheck = async (originalError) => {
	try {
		const latest = await checkGitHubRelease();
		if ( compareVersions(latest.version, app.getVersion()) > 0 ) {
			notifyManualDownload(latest.version, latest.url);
		} else if ( manual ) {
			send('autoUpdater:update-not-available');
		}
	} catch (error) {
		console.error('Update check failed:', originalError || error);
		if ( manual ) send('autoUpdater:error', String((originalError || error).message || originalError || error));
	}
};

const checkForUpdates = async (isManual) => {
	if ( checking ) {
		if ( isManual ) manual = true; // let the running check report back to the user
		return;
	}
	if ( downloadedInfo ) {
		// Already downloaded: just show the "install now" banner again
		if ( isManual ) send('autoUpdater:update-downloaded', downloadedInfo);
		return;
	}

	checking = true;
	manual = !!isManual;
	availableVersion = null;
	try {
		const result = await autoUpdater.checkForUpdates();
		if ( result === null ) {
			// electron-updater is not active for this installation (dev, snap, tar.gz, zip, ...)
			await fallbackCheck();
		} else if ( result && result.downloadPromise ) {
			// Download errors are handled by the 'error' event
			result.downloadPromise.catch(() => {});
		}
	} catch (error) {
		await fallbackCheck(error);
	} finally {
		checking = false;
	}
};

autoUpdater.on('update-available', (info) => {
	availableVersion = info.version;
	if ( manual ) send('autoUpdater:update-available', info.version);
});
autoUpdater.on('update-not-available', () => {
	if ( manual ) send('autoUpdater:update-not-available');
});
autoUpdater.on('update-downloaded', (info) => {
	downloadedInfo = { version: info.version, releaseName: info.releaseName, releaseDate: info.releaseDate };
	send('autoUpdater:update-downloaded', downloadedInfo);
});
autoUpdater.on('error', (error) => {
	console.error('AutoUpdater error:', error);
	// An update was found but could not be downloaded/installed automatically:
	// still let the user know so they can get it from GitHub.
	// (Errors during the check itself are handled in checkForUpdates.)
	if ( availableVersion && !downloadedInfo ) notifyManualDownload(availableVersion);
});

const initialize = (window) => {
	mainWindow = window;
	autoUpdater.on('checking-for-update', () => send('autoUpdater:checking-for-update'));

	ipcMain.on('autoUpdater:quit-and-install', (event) => {
		app.removeAllListeners('window-all-closed');
		BrowserWindow.getAllWindows().forEach((browserWindow) => browserWindow.removeAllListeners('close'));
		autoUpdater.quitAndInstall(true, true);
	});
	ipcMain.on('autoUpdater:check-for-updates', (event, options) => {
		checkForUpdates(!options || options.manual !== false);
	});

	// Automatic check on startup and every 24 hours afterwards
	if ( process.argv.indexOf('--without-update') === -1 ) {
		window.webContents.once('did-finish-load', () => {
			setTimeout(() => checkForUpdates(false), STARTUP_DELAY);
			setInterval(() => checkForUpdates(false), CHECK_INTERVAL);
		});
	}
};

module.exports = { initialize, compareVersions };
