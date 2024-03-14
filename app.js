// Enable Cookies
var ElectronCookies = require('@exponent/electron-cookies');
ElectronCookies.enable({ origin: 'localhost' });

// Sencha App
Ext.setGlyphFontFamily('FontAwesome');
Ext.application({
	 name: 'Rambox'

	,extend: 'Rambox.Application'

	,autoCreateViewport: 'Rambox.view.main.Main'
});

// auto update logic
const ipc = require('electron').ipcRenderer;

ipc.on('showAbout', function(event, message) {
	!Ext.cq1('about') ? Ext.create('Rambox.view.main.About') : '';
});
ipc.on('showPreferences', function(event, message) {
	!Ext.cq1('preferences') ? Ext.create('Rambox.view.preferences.Preferences').show() : '';
});
/*ipc.on('grantPermissions', async function() {
	await require('@electron/remote').systemPreferences.askForMediaAccess('microphone');
	await require('@electron/remote').systemPreferences.askForMediaAccess('camera');
});*/
ipc.on('autoUpdater:check-update', function() {
	Rambox.app.checkUpdate();
});
ipc.on('autoUpdater:update-not-available', function() {
	Ext.Msg.show({
		 title: 'You are up to date!'
		,message: 'You have the latest version of LibreRambox.'
		,icon: Ext.Msg.INFO
		,buttons: Ext.Msg.OK
	});
});
ipc.on('autoUpdater:update-available', function() {
	Ext.Msg.show({
		 title: 'New Version available!'
		,message: 'Please wait until LibreRambox download the new version and ask you for install it.'
		,icon: Ext.Msg.INFO
		,buttons: Ext.Msg.OK
	});
});
ipc.on('autoUpdater:update-downloaded', function(e, info) {
	console.log('Update downloaded!', info);
	Ext.cq1('app-main').addDocked({
		 xtype: 'toolbar'
		,dock: 'top'
		,ui: 'newversion'
		,items: [
			'->'
			,{
				 xtype: 'label'
				,html: '<b>New version is ready to be installed ('+info.version+')!</b> Click the following button to install it now.'
			}
			,{
				 xtype: 'button'
				,text: 'Install now'
				,handler: function(btn) { ipc.send('autoUpdater:quit-and-install'); }
			}
			,{
				 xtype: 'button'
				,text: 'Changelog'
				,ui: 'decline'
				,href: 'https://github.com/LibreRambox/LibreRambox/releases/latest'
			}
			,'->'
			,{
				 glyph: 'xf00d@FontAwesome'
				,baseCls: ''
				,style: 'cursor:pointer;'
				,handler: function(btn) { Ext.cq1('app-main').removeDocked(btn.up('toolbar'), true); }
			}
		]
	});
});

// Set Badge in taskbar for Windows
ipc.on('setBadge', function(event, messageCount) {
	messageCount = messageCount.toString();
	var canvas = document.createElement("canvas");
	canvas.height = 140;
	canvas.width = 140;
	var ctx = canvas.getContext("2d");
	ctx.fillStyle = "red";
	ctx.beginPath();
	ctx.ellipse(70, 70, 70, 70, 0, 0, 2 * Math.PI);
	ctx.fill();
	ctx.textAlign = "center";
	ctx.fillStyle = "white";

	var ranges = [
		{ divider: 1e18 , suffix: 'P' },
		{ divider: 1e15 , suffix: 'E' },
		{ divider: 1e12 , suffix: 'T' },
		{ divider: 1e9 , suffix: 'G' },
		{ divider: 1e6 , suffix: 'M' },
		{ divider: 1e3 , suffix: 'k' }
	];

	function formatNumber(n) {
		n = parseInt(n);
		for (var i = 0; i < ranges.length; i++) {
			if (n >= ranges[i].divider) {
				return Math.round(n / ranges[i].divider).toString() + ranges[i].suffix;
			}
		}
		return n.toString();
	}

	if (messageCount.length === 3) {
		ctx.font = "75px sans-serif";
		ctx.fillText("" + messageCount, 70, 98);
	} else if (messageCount.length === 2) {
		ctx.font = "100px sans-serif";
		ctx.fillText("" + messageCount, 70, 105);
	} else if (messageCount.length === 1) {
		ctx.font = "125px sans-serif";
		ctx.fillText("" + messageCount, 70, 112);
	} else {
		ctx.font = "75px sans-serif";
		ctx.fillText("" + formatNumber(messageCount), 70, 98);
	}

	ipc.send('setBadge', messageCount, canvas.toDataURL());
});
// Reload Current Service
ipc.on('reloadCurrentService', function(e) {
	var tab = Ext.cq1('app-main').getActiveTab();
	if ( tab.id !== 'ramboxTab' ) tab.reloadService();
});
// Toggle Status Bar
ipc.on('toggleStatusBar', function() {
	var tab = Ext.cq1('app-main').getActiveTab();

	if ( tab.id !== 'ramboxTab' ) {
		tab.down('statusbar').closed ? tab.setStatusBar(tab.record.get('statusbar')) : tab.closeStatusBar();
	}
});
// Focus the current service when Alt + Tab or click in webviews textfields
window.addEventListener('focus', function() {
	if(Ext.cq1("app-main")) Ext.cq1("app-main").getActiveTab().down('component').el.dom.focus();
});

// Handles zoom from menu
ipc.on('resetzoom-webview', function() {
	var tabPanel = Ext.cq1('app-main');
	if ( tabPanel.items.indexOf(tabPanel.getActiveTab()) === 0 ) return false;

	tabPanel.getActiveTab().resetZoom();
});
ipc.on('zoomin-webview', function() {
	var tabPanel = Ext.cq1('app-main');
	if ( tabPanel.items.indexOf(tabPanel.getActiveTab()) === 0 ) return false;

	tabPanel.getActiveTab().zoomIn();
});
ipc.on('zoomout-webview', function() {
	var tabPanel = Ext.cq1('app-main');
	if ( tabPanel.items.indexOf(tabPanel.getActiveTab()) === 0 ) return false;

	tabPanel.getActiveTab().zoomOut();
});
ipc.on('shortcut:tab', function(e, arg) {
	var tabPanel = Ext.cq1('app-main');
	if ( arg >= tabPanel.items.indexOf(Ext.getCmp('tbfill')) ) arg++;
		tabPanel.setActiveTab(arg);
});
