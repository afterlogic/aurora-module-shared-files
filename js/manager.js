'use strict';

module.exports = function (oAppData) {
	var
		App = require('%PathToCoreWebclientModule%/js/App.js'),

		bNormalUser = App.getUserRole() === window.Enums.UserRole.NormalUser
	;

	require('modules/%ModuleName%/js/enums.js');

	if (bNormalUser)
	{
		return {
			start: function (ModulesManager) {
				ModulesManager.run('FilesWebclient', 'registerToolbarButtons', [require('modules/%ModuleName%/js/views/ButtonsView.js')]);
			}
		};
	}

	return null;
};
