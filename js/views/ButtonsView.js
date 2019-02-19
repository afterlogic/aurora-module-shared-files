'use strict';

var
	ko = require('knockout'),
	
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Utils = require('%PathToCoreWebclientModule%/js/utils/Common.js'),
	
	Popups = require('%PathToCoreWebclientModule%/js/Popups.js'),
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
			oFilesView.enableCreateFolderButton('%ModuleName%');
			oFilesView.enableRenameButton('%ModuleName%');
			oFilesView.enableShortcutButton('%ModuleName%');
			this.isUploadEnabled(true);
		}
		else
		{
			oFilesView.disableCreateFolderButton('%ModuleName%');
			oFilesView.disableRenameButton('%ModuleName%');
			oFilesView.disableShortcutButton('%ModuleName%');
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
			oFilesView.disableDeleteButton('%ModuleName%');
		}
		else
		{
			oFilesView.enableDeleteButton('%ModuleName%');
		}
	}, this);
	this.shareCommand = Utils.createCommand(this, function () {
		Popups.showPopup(FilesSharePopup, [this.selectedItem()]);
	}, function () {
		return (this.selectedItem() !== null && oFilesView.selector.listCheckedAndSelected().length === 1);
	});
};

ButtonsView.prototype.isSharedStorage = function ()
{
	return this.storageType() === Enums.FileStorageType.Shared;
};

module.exports = new ButtonsView();
