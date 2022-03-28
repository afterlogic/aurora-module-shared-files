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

	this.shareCommand = Utils.createCommand(this, this.executeShare.bind(this, oFilesView), oFilesView.isShareAllowed);

	this.selectedSharedItems = ko.computed(function () {
		return _.filter(oFilesView.selector.listCheckedAndSelected(), function(item) {
			return item.sharedWithMe();
		});
	}, this);
	this.selectedSharedCount = ko.computed(function () {
		return this.selectedSharedItems().length;
	}, this);
	this.isLeaveShareAllowed = ko.computed(function () {
		return	!oFilesView.isZipFolder()
				&& !oFilesView.sharedParentFolder() && this.selectedSharedCount() > 0
				&& oFilesView.allSelectedFilesReady();
	}, this);
	this.leaveShareCommand = Utils.createCommand(this, this.executeLeaveShare.bind(this, oFilesView), this.isLeaveShareAllowed);
};

CButtonsView.prototype.executeShare = function (oFilesView)
{
	var oSelectedItem = oFilesView.selector.itemSelected();
	if (oSelectedItem.IS_FILE && oSelectedItem.bIsSecure() && oSelectedItem.oExtendedProps && !oSelectedItem.oExtendedProps.ParanoidKey) {
		Popups.showPopup(AlertPopup, [TextUtils.i18n('%MODULENAME%/INFO_SHARING_NOT_SUPPORTED'), null, TextUtils.i18n('%MODULENAME%/TITLE_SHARE_FILE')]);
	} else {
		Popups.showPopup(FilesSharePopup, [oSelectedItem]);
	}
};

CButtonsView.prototype.executeLeaveShare = function (oFilesView)
{
	var
		items = oFilesView.selector.listCheckedAndSelected() || [],
		sharedItems = this.selectedSharedItems(),
		sharedItemsCount = this.selectedSharedCount()
	;
	
	if (!oFilesView.bPublic || sharedItemsCount > 0) {
		var
			hasOwnItems = items.length !== sharedItemsCount,
			hasFolder = !!_.find(sharedItems, function (item) { return !item.IS_FILE; }),
			hasFile = !!_.find(sharedItems, function (item) { return item.IS_FILE; }),
			confirmText = ''
		;

		if (hasOwnItems) {
			confirmText = TextUtils.i18n('%MODULENAME%/CONFIRM_NOT_ALL_ITEMS_SHARED');
		} else if (hasFolder && hasFile) {
			confirmText = TextUtils.i18n('%MODULENAME%/CONFIRM_LEAVE_ITEMS_SHARE');
		} else if (hasFolder) {
			confirmText = TextUtils.i18n('%MODULENAME%/CONFIRM_LEAVE_FOLDERS_SHARE_PLURAL', {'NAME': sharedItems[0].fileName()}, null, sharedItemsCount);
		} else {
			confirmText = TextUtils.i18n('%MODULENAME%/CONFIRM_LEAVE_FILES_SHARE_PLURAL', {'NAME': sharedItems[0].fileName()}, null, sharedItemsCount);
		}

		oFilesView.selector.useKeyboardKeys(false);
		Popups.showPopup(ConfirmPopup, [confirmText, function (confirmedLeaveShare) {
			if (confirmedLeaveShare) {
				oFilesView.deleteItems(sharedItems, true, 'LeaveShare');
			}
		}, '', TextUtils.i18n('%MODULENAME%/ACTION_LEAVE_SHARE')]);
	}
};

module.exports = new CButtonsView();
