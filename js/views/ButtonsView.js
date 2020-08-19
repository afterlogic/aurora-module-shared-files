'use strict';

var
	ko = require('knockout'),
	
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Utils = require('%PathToCoreWebclientModule%/js/utils/Common.js'),
	
	Popups = require('%PathToCoreWebclientModule%/js/Popups.js'),
	AlertPopup = require('%PathToCoreWebclientModule%/js/popups/AlertPopup.js'),
	
	FilesSharePopup = require('modules/%ModuleName%/js/popups/FilesSharePopup.js')
;

/**
 * @constructor
 */
function ButtonsView()
{
	this.shareTooltip = ko.computed(function () {
		return TextUtils.i18n('%MODULENAME%/ACTION_SHARE');
	}, this);
	this.storageType = null;
	this.isUploadEnabled = ko.observable(false);
}

ButtonsView.prototype.ViewTemplate = '%ModuleName%_ButtonsView';

ButtonsView.prototype.useFilesViewData = function (oFilesView)
{
	this.selectedItem = oFilesView.selector.itemSelected;
	this.storageType = oFilesView.storageType;
	oFilesView.pathItems.subscribe(function () {
		var
			iPathItemsLength = oFilesView.pathItems().length,
			oLastPathItem = oFilesView.pathItems()[iPathItemsLength - 1] || false
		;

		//Disable toolbar buttons for "root" directory of Shared files
		//and for folders with access level "Read"
		if (!this.isSharedStorage()
			|| (iPathItemsLength !== 0
				&& oLastPathItem.oExtendedProps
				&& oLastPathItem.oExtendedProps.Access
				&& oLastPathItem.oExtendedProps.Access === Enums.SharedFileAccess.Write
			)
		)
		{
			oFilesView.enableButton(oFilesView.createFolderButtonModules, '%ModuleName%');
			oFilesView.enableButton(oFilesView.renameButtonModules, '%ModuleName%');
			oFilesView.enableButton(oFilesView.shortcutButtonModules, '%ModuleName%');
			this.isUploadEnabled(true);
		}
		else
		{
			oFilesView.disableButton(oFilesView.createFolderButtonModules, '%ModuleName%');
			oFilesView.disableButton(oFilesView.renameButtonModules, '%ModuleName%');
			oFilesView.disableButton(oFilesView.shortcutButtonModules, '%ModuleName%');
			this.isUploadEnabled(false);
		}
		//Disable delete buttons for folders with access level "Read"
		if (this.isSharedStorage()
			&& iPathItemsLength !== 0
			&& oLastPathItem.oExtendedProps
			&& oLastPathItem.oExtendedProps.Access
			&& oLastPathItem.oExtendedProps.Access !== Enums.SharedFileAccess.Write
		)
		{
			oFilesView.disableButton(oFilesView.deleteButtonModules, '%ModuleName%');
		}
		else
		{
			oFilesView.enableButton(oFilesView.deleteButtonModules, '%ModuleName%');
		}
	}, this);
	this.shareCommand = Utils.createCommand(
		this,
		function () {
			if (this.selectedItem().IS_FILE && this.selectedItem().bIsSecure() && this.selectedItem().oExtendedProps && !this.selectedItem().oExtendedProps.ParanoidKey)
			{
				Popups.showPopup(AlertPopup, [TextUtils.i18n('%MODULENAME%/INFO_SHARING_NOT_SUPPORTED'), null, TextUtils.i18n('%MODULENAME%/TITLE_SHARE_FILE')]);
			}
			else
			{
				Popups.showPopup(FilesSharePopup, [this.selectedItem()]);
			}
		},
		function () {
			// Conditions for button activity:
			// Personal: one file or one folder
			// Encrypted: one file only
			// Corporate: nothing
			// Shared: nothing
			return (
				!oFilesView.isZipFolder()
				&& this.selectedItem() !== null
				&& oFilesView.selector.listCheckedAndSelected().length === 1
				&& oFilesView.checkedReadyForOperations()
				&& (
					oFilesView.storageType() === Enums.FileStorageType.Personal
					|| oFilesView.storageType() === Enums.FileStorageType.Encrypted && this.selectedItem().IS_FILE
				)
			);
		}
	);
};

ButtonsView.prototype.isSharedStorage = function ()
{
	return this.storageType() === Enums.FileStorageType.Shared;
};

module.exports = new ButtonsView();
