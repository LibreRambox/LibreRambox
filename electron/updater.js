const { app, ipcMain, BrowserWindow } = require('electron');
const { autoUpdater } = require("electron-updater");

// autoUpdater.logger = require("electron-log");
// autoUpdater.logger.transports.file.level = "debug";
// autoUpdater.currentVersion = '0.8.1';
// autoUpdater.updateConfigPath = path.join(__dirname, 'dev-app-update.yml');

autoUpdater.setFeedURL({
	"provider": "github",
	"owner": "KevinRoebert",
	"repo": "rambox-build",
	"vPrefixedTagName": true
});

const initialize = (window) => {
	const webContents = window.webContents;
	const send = webContents.send.bind(window.webContents);
	autoUpdater.on('checking-for-update', (event) => send('autoUpdater:checking-for-update'));
	autoUpdater.on('update-downloaded', (...args) => send('autoUpdater:update-downloaded', ...args));
	ipcMain.on('autoUpdater:quit-and-install', (event) => {
		app.removeAllListeners('window-all-closed');
		BrowserWindow.getAllWindows().forEach((browserWindow) => browserWindow.removeAllListeners('close'));
		autoUpdater.quitAndInstall(true, true);
	});
	ipcMain.on('autoUpdater:check-for-updates', (event) => autoUpdater.checkForUpdates());
};

module.exports = {initialize};
