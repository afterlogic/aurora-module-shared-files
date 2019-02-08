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
}

ButtonsView.prototype.ViewTemplate = '%ModuleName%_ButtonsView';

ButtonsView.prototype.useFilesViewData = function (oFilesView)
{
	this.selectedItem = oFilesView.selector.itemSelected;
	this.storageType = oFilesView.storageType;

	this.shareCommand = Utils.createCommand(this, function () {
		Popups.showPopup(FilesSharePopup, [this.selectedItem()]);
	}, function () {
		return (this.selectedItem() !== null && oFilesView.selector.listCheckedAndSelected().length === 1);
	});
};

ButtonsView.prototype.isVisible = function ()
{
	return this.storageType() !== Enums.FileStorageType.Shared;
};

module.exports = new ButtonsView();
