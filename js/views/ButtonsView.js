'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),
	
	Ajax = require('%PathToCoreWebclientModule%/js/Ajax.js'),
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Utils = require('%PathToCoreWebclientModule%/js/utils/Common.js'),
	
	Popups = require('%PathToCoreWebclientModule%/js/Popups.js'),
	AlertPopup = require('%PathToCoreWebclientModule%/js/popups/AlertPopup.js'),
	FilesSharePopup = require('modules/%ModuleName%/js/popups/FilesSharePopup.js')
;

/**
 * @constructor
 */
function CButtonsView()
{
	this.shareTooltip = ko.computed(function () {
			return TextUtils.i18n('%MODULENAME%/ACTION_SHARE');
	}, this);
}

CButtonsView.prototype.ViewTemplate = '%ModuleName%_ButtonsView';

CButtonsView.prototype.useFilesViewData = function (oFilesView)
{
	this.selectedItem = oFilesView.selector.itemSelected;

	this.shareCommand = Utils.createCommand(this, function () {
		Popups.showPopup(FilesSharePopup, [
			_.bind(this.UpdateShare, this), this.selectedItem]);
	}, function () {
		return (this.selectedItem() !== null);
	});
};

CButtonsView.prototype.UpdateShare = function (sStorage, sPath, sId, aShares)
{
	console.log('UpdateShare');

	var	oParameters = {
		'Storage': sStorage,
		'Path': sPath,
		'Id': sId,
		'Shares': aShares 
	};		
	Ajax.send('%ModuleName%', 'UpdateShare', oParameters, this.onUpdateShareResponse);
};

CButtonsView.prototype.onUpdateShareResponse = function ()
{
	console.log(arguments);
};


module.exports = new CButtonsView();
