Ext.define('LibreRambox.store.Services', {
	 extend: 'Ext.data.Store'
	,alias: 'store.services'

	,requires: [
		'Ext.data.proxy.LocalStorage'
	]

	,model: 'LibreRambox.model.Service'

	,autoLoad: false
	,autoSync: true
	,pageSize: 0

	,groupField: 'align'
	,sorters: [
		{
			 property: 'position'
			,direction: 'ASC'
		}
	]

	,listeners: {
		 load: function( store, records, successful ) {
			Ext.cq1('app-main').suspendEvent('add');

			var servicesLeft = [];
			var servicesRight = [];
			store.each(function(service) {
				// If the service is disabled, we dont add it to tab bar
				if ( !service.get('enabled') ) return;

				// Rebranded app
				if ( service.get('type') === 'spark' ) {
					service.set('type', 'webexteams');
					service.set('logo', 'webexteams.png');
				}

				var cfg = {
					 xtype: 'webview'
					,id: 'tab_'+service.get('id')
					,title: service.get('name')
					,icon: service.get('type') !== 'custom' ? 'resources/icons/'+service.get('logo') : ( service.get('logo') === '' ? 'resources/icons/custom.png' : service.get('logo'))
					,src: service.get('url')
					,type: service.get('type')
					,muted: service.get('muted')
					,includeInGlobalUnreadCounter: service.get('includeInGlobalUnreadCounter')
					,displayTabUnreadCounter: service.get('displayTabUnreadCounter')
					,enabled: service.get('enabled')
					,record: service
					,useragent: ipc.sendSync('getConfig').user_agent
					,tabConfig: {
						service: service
					}
				};

				service.get('align') === 'left' ? servicesLeft.push(cfg) : servicesRight.push(cfg);
			});

			if ( !Ext.isEmpty(servicesLeft) ) Ext.cq1('app-main').insert(1, servicesLeft);
			if ( !Ext.isEmpty(servicesRight) ) Ext.cq1('app-main').add(servicesRight);

			// Set default active service
			const config = ipc.sendSync('getConfig');
			switch ( config.default_service ) {
				case 'last':
					Ext.cq1('app-main').setActiveTab(localStorage.getItem('last_active_service'));
					break;
				case 'libreRamboxTab':
					break;
				default:
					if ( Ext.getCmp('tab_'+config.default_service) ) Ext.cq1('app-main').setActiveTab('tab_'+config.default_service);
					break;
			}

			store.suspendEvent('load');
			Ext.cq1('app-main').resumeEvent('add');
		}
		,datachanged: function(store, eOpts) {
			var isEmpty = store.getCount() > 0 ? false : true;
			Ext.cq1('app-main').getViewModel().set('emptyServices', isEmpty);
		}
	}
});
