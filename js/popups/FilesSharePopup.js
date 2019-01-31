'use strict';

var
	_ = require('underscore'),
	$ = require('jquery'),
	ko = require('knockout'),

	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),
	Utils = require('%PathToCoreWebclientModule%/js/utils/Common.js'),
	AddressUtils = require('%PathToCoreWebclientModule%/js/utils/Address.js'),

	App = require('%PathToCoreWebclientModule%/js/App.js'),
	CAbstractPopup = require('%PathToCoreWebclientModule%/js/popups/CAbstractPopup.js'),
	Ajax = require('%PathToCoreWebclientModule%/js/Ajax.js')
;


/**
 * @constructor
 */
function FilesSharePopup()
{
	CAbstractPopup.call(this);

	this.guestsDom = ko.observable();
	this.guestsDom.subscribe(function (a) {
		this.initInputosaurus(this.guestsDom, this.guests, this.guestsLock);
	}, this);
	this.ownersDom = ko.observable();
	this.ownersDom.subscribe(function () {
		this.initInputosaurus(this.ownersDom, this.owners, this.ownersLock);
	}, this);

	this.guestsLock = ko.observable(false);
	this.guests = ko.observable('').extend({'reversible': true});
	this.guests.subscribe(function () {
		if (!this.guestsLock())
		{
			$(this.guestsDom()).val(this.guests());
			$(this.guestsDom()).inputosaurus('refresh');
		}
	}, this);
	this.ownersLock = ko.observable(false);
	this.owners = ko.observable('').extend({'reversible': true});
	this.owners.subscribe(function () {
		if (!this.ownersLock())
		{
			$(this.ownersDom()).val(this.owners());
			$(this.ownersDom()).inputosaurus('refresh');
		}
	}, this);

	this.owner = ko.observable('');
	this.storage = ko.observable('');
	this.path = ko.observable('');
	this.id = ko.observable('');
	this.shares = ko.observableArray([]);

	this.recivedAnim = ko.observable(false).extend({'autoResetToFalse': 500});
	this.whomAnimate = ko.observable('');

	this.newShare = ko.observable('');
	this.newShareFocus = ko.observable(false);
	this.newShareAccess = ko.observable(Enums.SharedFileAccess.Read);
	this.sharedToAll = ko.observable(false);
	this.sharedToAllAccess = ko.observable(Enums.SharedFileAccess.Read);
	this.canAdd = ko.observable(false);
	this.aAccess = [
		{'value': Enums.SharedFileAccess.Read, 'display': TextUtils.i18n('%MODULENAME%/LABEL_READ_ACCESS')},
		{'value': Enums.SharedFileAccess.Write, 'display': TextUtils.i18n('%MODULENAME%/LABEL_WRITE_ACCESS')}
	];
	this.oFileItem = ko.observable(null);
}

_.extendOwn(FilesSharePopup.prototype, CAbstractPopup.prototype);

FilesSharePopup.prototype.PopupTemplate = '%ModuleName%_FilesSharePopup';


/**
 *
 * @param {Object} oCalendar
 */
FilesSharePopup.prototype.onOpen = function (oFileItem)
{
	if (!_.isUndefined(oFileItem))
	{
		this.oFileItem(oFileItem);
		this.storage(oFileItem.storageType());
		this.path(oFileItem.path());
		this.id(oFileItem.id());
		if (oFileItem.oExtendedProps && oFileItem.oExtendedProps.Shares)
		{
			this.populateShares(oFileItem.oExtendedProps.Shares);
		}
		else
		{
			this.populateShares([]);
		}
	}
};

FilesSharePopup.prototype.onSaveClick = function ()
{
	this.UpdateShare(this.storage(), this.path(), this.id(), this.getShares());

	this.closePopup();
};

FilesSharePopup.prototype.onEscHandler = function ()
{
	this.cancelPopup();
};

/**
 * @param {string} sTerm
 * @param {Function} fResponse
 */
FilesSharePopup.prototype.autocompleteCallback = function (sTerm, fResponse)
{
	var
		oParameters = {
			'Search': sTerm,
			'SortField': Enums.ContactSortField.Frequency,
			'SortOrder': 1,
			'Storage': 'team'
		}
	;

	Ajax.send('Contacts', 'GetContacts', oParameters, function (oData) {
		var aList = [];
		if (oData && oData.Result && oData.Result && oData.Result.List)
		{
			aList = _.map(oData.Result.List, function (oItem) {
				return oItem && oItem.ViewEmail && oItem.ViewEmail !== this.owner() ?
					(oItem.Name && 0 < Utils.trim(oItem.Name).length ?
						oItem.ForSharedToAll ? {value: oItem.Name, name: oItem.Name, email: oItem.ViewEmail, frequency: oItem.Frequency} :
						{value:'"' + oItem.Name + '" <' + oItem.ViewEmail + '>', name: oItem.Name, email: oItem.ViewEmail, frequency: oItem.Frequency} : {value: oItem.ViewEmail, name: '', email: oItem.ViewEmail, frequency: oItem.Frequency}) : null;
			}, this);

			aList = _.sortBy(_.compact(aList), function(num){
				return num.frequency;
			}).reverse();
		}

		fResponse(aList);

	}, this);
};

FilesSharePopup.prototype.initInputosaurus = function (koDom, ko, koLock)
{
	if (koDom() && $(koDom()).length > 0)
	{
		$(koDom()).inputosaurus({
			width: 'auto',
			parseOnBlur: true,
			autoCompleteSource: _.bind(function (oData, fResponse) {
				this.autocompleteCallback(oData.term, fResponse);
			}, this),
			change : _.bind(function (ev) {
				koLock(true);
				this.setRecipient(ko, ev.target.value);
				koLock(false);
			}, this),
			copy: _.bind(function (sVal) {
				this.inputosaurusBuffer = sVal;
			}, this),
			paste: _.bind(function () {
				var sInputosaurusBuffer = this.inputosaurusBuffer || '';
				this.inputosaurusBuffer = '';
				return sInputosaurusBuffer;
			}, this),
			mobileDevice: App.isMobile()
		});
	}
};

FilesSharePopup.prototype.setRecipient = function (koRecipient, sRecipient)
{
	if (koRecipient() === sRecipient)
	{
		koRecipient.valueHasMutated();
	}
	else
	{
		koRecipient(sRecipient);
	}
};
/**
 * Returns array of shares from popup
 * @returns {Array}
 */
FilesSharePopup.prototype.getShares = function ()
{
	return $.merge(_.map(AddressUtils.getArrayRecipients(this.guests(), false), function(oGuest){
			return {
				PublicId: oGuest.email,
				Access: Enums.SharedFileAccess.Read
			};
		}),
		_.map(AddressUtils.getArrayRecipients(this.owners(), false), function(oOwner){
			return {
				PublicId: oOwner.email,
				Access: Enums.SharedFileAccess.Write
			};
		}));
};


FilesSharePopup.prototype.populateShares = function (aShares)
{
	var
		sGuests = '',
		sOwners = ''
	;

	_.each(aShares, function (oShare) {
		if (Types.pInt(oShare.Access, Enums.SharedFileAccess.Read) === Enums.SharedFileAccess.Read && oShare.PublicId !== '')//Enums
		{
			sGuests = sGuests + oShare.PublicId + ', ';
		}
		else if (Types.pInt(oShare.Access, Enums.SharedFileAccess.Read) === Enums.SharedFileAccess.Write && oShare.PublicId !== '')//Enums
		{
			sOwners = sOwners + oShare.PublicId + ', ';
		}
	}, this);

	this.setRecipient(this.guests, sGuests);
	this.setRecipient(this.owners, sOwners);
};

FilesSharePopup.prototype.UpdateShare = function (sStorage, sPath, sId, aShares)
{
	var
		oParameters = {
			'Storage': sStorage,
			'Path': sPath,
			'Id': sId,
			'Shares': aShares 
		}
	;

	Ajax.send('%ModuleName%', 'UpdateShare', oParameters, _.bind(this.onUpdateShareResponse, this));
};

FilesSharePopup.prototype.onUpdateShareResponse = function (oResponse, oRequest)
{
	if (oResponse.Result)
	{
		//Update shares list in oFile object
		this.oFileItem().oExtendedProps.Shares = [];
		_.each(this.getShares(), _.bind(function (oShare) {
			this.oFileItem().oExtendedProps.Shares.push({
				'Access': oShare.Access,
				'PublicId': oShare.PublicId
			});
		}, this));
	}
	this.oFileItem(null);
};

module.exports = new FilesSharePopup();