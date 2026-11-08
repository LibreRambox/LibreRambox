Ext.define('LibreRambox.model.Service', {
	 extend: 'Ext.data.Model'

	,identifier: 'sequential'
	,proxy: {
		 type: 'localstorage'
		,id: 'services'
	}

	,fields: [{
		 name: 'id'
		,type: 'int'
	},{
		 name: 'position'
		,type: 'int'
	},{
		 name: 'type'
		,type: 'string'
	},{
		 name: 'logo'
		,type: 'string'
	},{
		 name: 'name'
		,type: 'string'
	},{
		 name: 'url'
		,type: 'string'
	},{
		 name: 'align'
		,type: 'string'
		,defaultValue: 'left'
	},{
		 name: 'notifications'
		,type: 'boolean'
		,defaultValue: true
	},{
		 name: 'muted'
		,type: 'boolean'
		,defaultValue: false
	},{
		 name: 'tabname'
		,type: 'boolean'
		,defaultValue: true
	},{
		 name: 'statusbar'
		,type: 'boolean'
		,defaultValue: true
	},{
		 name: 'displayTabUnreadCounter'
		,type: 'boolean'
		,defaultValue: true
	},{
		 name: 'includeInGlobalUnreadCounter'
		,type: 'boolean'
		,defaultValue: true
	},{
		 name: 'trust'
		,type: 'boolean'
		,defaultValue: false
	},{
		 name: 'enabled'
		,type: 'boolean'
		,defaultValue: true
	},{
		 name: 'js_unread'
		,type: 'string'
		,defaultValue: ''
	},{
		 name: 'zoomLevel'
		,type: 'number'
		,defaultValue: 0
	},{
		// Hibernation: unload the service when it has not been used for a while to save RAM
		 name: 'hibernate'
		,type: 'boolean'
		,defaultValue: false
	},{
		 name: 'hibernateAfter' // minutes in background before hibernating
		,type: 'int'
		,defaultValue: 15
	},{
		 name: 'hibernateOnSelect' // 'auto' = wake up when the tab is selected, 'ask' = show a "Wake up now" button
		,type: 'string'
		,defaultValue: 'auto'
	},{
		 name: 'hibernateRewake' // periodically wake up in background to check for new messages
		,type: 'boolean'
		,defaultValue: false
	},{
		 name: 'hibernateRewakeEvery' // minutes between background wake-ups
		,type: 'int'
		,defaultValue: 15
	},{
		 name: 'hibernateRewakeFor' // minutes to stay awake before hibernating again
		,type: 'int'
		,defaultValue: 1
	}]
});
