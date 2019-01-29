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
	Popups = require('%PathToCoreWebclientModule%/js/Popups.js'),
	CAbstractPopup = require('%PathToCoreWebclientModule%/js/popups/CAbstractPopup.js'),
	AlertPopup = require('%PathToCoreWebclientModule%/js/popups/AlertPopup.js'),
	Ajax = require('%PathToCoreWebclientModule%/js/Ajax.js')
;


/**
 * @constructor
 */
function CFilesSharePopup()
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


	this.fCallback = null;

	this.owner = ko.observable('');
	this.storage = ko.observable('');
	this.path = ko.observable('');
	this.id = ko.observable('');
	this.shares = ko.observableArray([]);

	this.recivedAnim = ko.observable(false).extend({'autoResetToFalse': 500});
	this.whomAnimate = ko.observable('');

	this.newShare = ko.observable('');
	this.newShareFocus = ko.observable(false);
	this.newShareAccess = ko.observable(Enums.CalendarAccess.Read);
	this.sharedToAll = ko.observable(false);
	this.sharedToAllAccess = ko.observable(Enums.CalendarAccess.Read);
	this.canAdd = ko.observable(false);
	this.aAccess = [
		{'value': Enums.CalendarAccess.Read, 'display': TextUtils.i18n('%MODULENAME%/LABEL_READ_ACCESS')},
		{'value': Enums.CalendarAccess.Write, 'display': TextUtils.i18n('%MODULENAME%/LABEL_WRITE_ACCESS')}
	];
}

_.extendOwn(CFilesSharePopup.prototype, CAbstractPopup.prototype);

CFilesSharePopup.prototype.PopupTemplate = '%ModuleName%_FilesSharePopup';


/**
 * @param {Function} fCallback
 * @param {Object} oCalendar
 */
CFilesSharePopup.prototype.onOpen = function (fCallback, oFileItem)
{
	if (_.isFunction(fCallback))
	{
		this.fCallback = fCallback;
	}
	if (!_.isUndefined(oFileItem))
	{
		
		this.storage(oFileItem().storageType());
		this.path(oFileItem().path());
		this.id(oFileItem().id());
/*
		this.populateShares(oCalendar.shares());
*/
	}
};

CFilesSharePopup.prototype.onSaveClick = function ()
{
	if (this.fCallback)
	{
		this.fCallback(this.storage(), this.path(), this.id(), this.getShares());
	}
	this.closePopup();
};

CFilesSharePopup.prototype.onEscHandler = function ()
{
	this.cancelPopup();
};

CFilesSharePopup.prototype.onClose = function ()
{
	this.cleanAll();
};

CFilesSharePopup.prototype.cleanAll = function ()
{
	this.newShare('');
	this.newShareAccess(Enums.CalendarAccess.Read);
	this.shareToAllAccess = ko.observable(Enums.CalendarAccess.Read);
	//this.shareAutocompleteItem(null);
	this.canAdd(false);
};

/**
 * @param {string} sTerm
 * @param {Function} fResponse
 */
CFilesSharePopup.prototype.autocompleteCallback = function (sTerm, fResponse)
{
	var	oParameters = {
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

/**
 * @param {string} sEmail
 */
CFilesSharePopup.prototype.itsMe = function (sEmail)
{
	return (sEmail === App.getUserPublicId());
};

CFilesSharePopup.prototype.initInputosaurus = function (koDom, ko, koLock)
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

CFilesSharePopup.prototype.setRecipient = function (koRecipient, sRecipient)
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

CFilesSharePopup.prototype.getShares = function ()
{
	return $.merge(_.map(AddressUtils.getArrayRecipients(this.guests(), false), function(oGuest){
			return {
				PublicId: oGuest.email,
				Access: Enums.CalendarAccess.Read
			};
		}),
		_.map(AddressUtils.getArrayRecipients(this.owners(), false), function(oOwner){
			return {
				PublicId: oOwner.email,
				Access: Enums.CalendarAccess.Write
			};
		}));
};

CFilesSharePopup.prototype.populateShares = function (aShares)
{
	var
		sGuests = '',
		sOwners = ''
	;

	_.each(aShares, function (oShare) {
		if (oShare.access === Enums.CalendarAccess.Read)
		{
			sGuests = oShare.name !== '' && oShare.name !== oShare.email ? 
						sGuests + '"' + oShare.name + '" <' + oShare.email + '>,' : 
						sGuests + oShare.email + ', ';
		}
		else if (oShare.access === Enums.CalendarAccess.Write)
		{
			sOwners = oShare.name !== '' && oShare.name !== oShare.email ? 
						sOwners + '"' + oShare.name + '" <' + oShare.email + '>,' : 
						sOwners + oShare.email + ', ';
		}
	}, this);

	this.setRecipient (this.guests, sGuests);
	this.setRecipient (this.owners, sOwners);
};

module.exports = new CFilesSharePopup();