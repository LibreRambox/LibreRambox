const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// Minimal replacement for the unmaintained `auto-launch` package.
// macOS/Windows use Electron's native login items API, Linux uses an
// XDG autostart .desktop file.
// Note: there is no "start hidden" option — Electron 44 removed
// `openAsHidden`/`wasOpenedAsHidden` (pre-macOS-13 APIs).

const desktopFile = path.join(app.getPath('home'), '.config', 'autostart', 'librerambox.desktop');

// Inside an AppImage `process.execPath` points into the ephemeral FUSE mount
// (/tmp/.mount_*), which dies on unmount. The AppImage runtime exposes the
// persistent path of the .AppImage file itself via the APPIMAGE env variable.
const executablePath = process.env.APPIMAGE || process.execPath;

const desktopEntry = `[Desktop Entry]
Type=Application
Name=LibreRambox
Comment=Free and Open Source messaging and emailing app
Exec=${executablePath}
Terminal=false
X-GNOME-Autostart-enabled=true
`;

exports.enable = function() {
	if ( process.platform === 'darwin' || process.platform === 'win32' ) {
		app.setLoginItemSettings({ openAtLogin: true });
		return;
	}
	fs.mkdirSync(path.dirname(desktopFile), { recursive: true });
	fs.writeFileSync(desktopFile, desktopEntry);
};

exports.disable = function() {
	if ( process.platform === 'darwin' || process.platform === 'win32' ) {
		app.setLoginItemSettings({ openAtLogin: false });
		return;
	}
	if ( fs.existsSync(desktopFile) ) fs.unlinkSync(desktopFile);
};
