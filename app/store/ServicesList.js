Ext.define('LibreRambox.store.ServicesList', {
	 extend: 'Ext.data.Store'
	,alias: 'store.serviceslist'

	,requires: [
		'Ext.data.proxy.LocalStorage'
	]

	,model: 'LibreRambox.model.ServiceList'

	,proxy: {
		type: 'ajax',
		url: 'resources/services.json',
		reader: {
			type: 'json',
			rootProperty: 'responseText'
		}
	}
	,listeners: {
		load: function () {
			Ext.get('spinner') ? Ext.get('spinner').destroy() : null;
			Ext.get('background') ? Ext.get('background').destroy() : null;
			this.add({
			 	id: 'custom'
				,logo: 'custom.png'
				,name: '_Custom Service'
				,description: locale['services[38]']
				,url: '___'
				,type: 'custom'
				,allow_popups: true
			})
		}
	}
	,sorters: [{
		 property: 'name'
		,direction: 'ASC'
	}]

	,autoLoad: true
	,autoSync: true
	,pageSize: 100000
});
