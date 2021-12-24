'use strict';

module.exports = function (oAppData) {
	var
		_ = require('underscore'),

		App = require('%PathToCoreWebclientModule%/js/App.js'),

		oButtonsView = null
	;

	function getButtonView()
	{
		if (!oButtonsView)
		{
			oButtonsView = require('modules/%ModuleName%/js/views/ButtonsView.js');
		}

		return oButtonsView;
	}

	if (App.isUserNormalOrTenant())
	{
		return {
			start: function (ModulesManager) {
				ModulesManager.run('FilesWebclient', 'registerToolbarButtons', [getButtonView()]);
				App.subscribeEvent('FilesWebclient::ParseFile::after', function (aParams) {

					var
						oFile = aParams[0],
						bIsShared = typeof(oFile.oExtendedProps) !== 'undefined'
							&&  typeof(oFile.oExtendedProps.Shares) !== 'undefined'
							&& _.isArray(oFile.oExtendedProps.Shares)
							&& oFile.oExtendedProps.Shares.length > 0
					;

					if (bIsShared)
					{
						oFile.sharedWithOthers(true);
					}
				});
				App.subscribeEvent('FilesWebclient::ParseFolder::after', function (aParams) {

					var
						oFolder = aParams[0],
						bIsShared = typeof(oFolder.oExtendedProps) !== 'undefined'
							&&  typeof(oFolder.oExtendedProps.Shares) !== 'undefined'
							&& _.isArray(oFolder.oExtendedProps.Shares)
							&& oFolder.oExtendedProps.Shares.length > 0
					;

					if (bIsShared)
					{
						oFolder.sharedWithOthers(true);
					}
				});
			},
			getFilesSharePopup: function () {
				return require('modules/SharedFiles/js/popups/FilesSharePopup.js');
			}
		};
	}

	return null;
};
