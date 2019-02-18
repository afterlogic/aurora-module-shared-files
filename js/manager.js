'use strict';

module.exports = function (oAppData) {
	var
		_ = require('underscore'),
		App = require('%PathToCoreWebclientModule%/js/App.js'),
		TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
		Screens = require('%PathToCoreWebclientModule%/js/Screens.js'),
		oButtonsView = null,
		bNormalUser = App.getUserRole() === window.Enums.UserRole.NormalUser
	;

	require('modules/%ModuleName%/js/enums.js');

	function getButtonView()
	{
		if (!oButtonsView)
		{
			oButtonsView = require('modules/%ModuleName%/js/views/ButtonsView.js');
		}

		return oButtonsView;
	}

	if (bNormalUser)
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
						oFile.bIsShared(true);
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
						oFolder.bIsShared(true);
					}
				});
				App.subscribeEvent('Jua::FileUpload::isUploadAvailable', function (oParams) {
					if (!getButtonView().isUploadEnabled())
					{
						Screens.showError(TextUtils.i18n('%MODULENAME%/ERROR_NOT_ENOUGH_PERMISSIONS'));
						oParams.isUploadAvailable(false);
					}
				});
			}
		};
	}

	return null;
};
