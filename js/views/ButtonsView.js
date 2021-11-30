'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Utils = require('%PathToCoreWebclientModule%/js/utils/Common.js'),
	
	Popups = require('%PathToCoreWebclientModule%/js/Popups.js'),
	AlertPopup = require('%PathToCoreWebclientModule%/js/popups/AlertPopup.js'),
	ConfirmPopup = require('%PathToCoreWebclientModule%/js/popups/ConfirmPopup.js'),
	
	FilesSharePopup = require('modules/%ModuleName%/js/popups/FilesSharePopup.js')
;

/**
 * @constructor
 */
function CButtonsView()
{
}

CButtonsView.prototype.ViewTemplate = '%ModuleName%_ButtonsView';

CButtonsView.prototype.useFilesViewData = function (oFilesView)
{
	this.isShareVisible = ko.computed(function () {
		return !oFilesView.isCorporateStorage();
	});

	this.shareCommand = Utils.createCommand(oFilesView, this.executeShare, oFilesView.isShareAllowed);

	this.isLeaveShareAllowed = ko.computed(function () {
		var
			aItems = oFilesView.selector.listCheckedAndSelected(),
			oSelectedItem = aItems.length === 1 ? aItems[0] : null
		;
		return	!oFilesView.isZipFolder() && !oFilesView.sharedParentFolder()
				&& oFilesView.allSelectedFilesReady()
				&& oSelectedItem && oSelectedItem.bSharedWithMe;
	});
	this.leaveShareCommand = Utils.createCommand(oFilesView, this.executeLeaveShare, this.isLeaveShareAllowed);
};

CButtonsView.prototype.executeShare = function ()
{
	// !!! this = oFilesView
	var oSelectedItem = this.selector.itemSelected();
	if (oSelectedItem.IS_FILE && oSelectedItem.bIsSecure() && oSelectedItem.oExtendedProps && !oSelectedItem.oExtendedProps.ParanoidKey) {
		Popups.showPopup(AlertPopup, [TextUtils.i18n('%MODULENAME%/INFO_SHARING_NOT_SUPPORTED'), null, TextUtils.i18n('%MODULENAME%/TITLE_SHARE_FILE')]);
	} else {
		Popups.showPopup(FilesSharePopup, [oSelectedItem]);
	}
};

CButtonsView.prototype.executeLeaveShare = function ()
{
	// !!! this = oFilesView
	var
		aChecked = this.selector.listCheckedAndSelected() || [],
		oSelectedItem = aChecked.length === 1 ? aChecked[0] : null,
		sConfirm = ''
	;
	
	if (oSelectedItem.IS_FILE) {
		sConfirm = TextUtils.i18n('%MODULENAME%/CONFIRM_LEAVE_FILE_SHARE');
	} else {
		sConfirm = TextUtils.i18n('%MODULENAME%/CONFIRM_LEAVE_FOLDER_SHARE');
	}
	
	if (!this.bPublic && oSelectedItem) {
		this.selector.useKeyboardKeys(false);
		Popups.showPopup(ConfirmPopup, [sConfirm, _.bind(this.deleteItems, this, aChecked), '', TextUtils.i18n('%MODULENAME%/ACTION_LEAVE_SHARE')]);
	}
};

module.exports = new CButtonsView();
