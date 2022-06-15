'use strict';

module.exports = function (appData) {
	const
		App = require('%PathToCoreWebclientModule%/js/App.js'),
		ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js')
	;

	if (ModulesManager.isModuleAvailable('FilesWebclient') && App.isUserNormalOrTenant()) {
		return {
			start: function (ModulesManager) {
				const buttonsView = require('modules/%ModuleName%/js/views/ButtonsView.js');
				ModulesManager.run('FilesWebclient', 'registerToolbarButtons', [buttonsView]);
			},

			getFilesSharePopup: function () {
				return require('modules/SharedFiles/js/popups/FilesSharePopup.js');
			}
		};
	}

	return null;
};
