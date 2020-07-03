'use strict';

var
	_ = require('underscore'),
	$ = require('jquery'),
	ko = require('knockout'),

	AddressUtils = require('%PathToCoreWebclientModule%/js/utils/Address.js'),
	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),

	Ajax = require('%PathToCoreWebclientModule%/js/Ajax.js'),
	Api = require('%PathToCoreWebclientModule%/js/Api.js'),
	App = require('%PathToCoreWebclientModule%/js/App.js'),
	CAbstractPopup = require('%PathToCoreWebclientModule%/js/popups/CAbstractPopup.js'),
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
	Popups = require('%PathToCoreWebclientModule%/js/Popups.js'),
	Screens = require('%PathToCoreWebclientModule%/js/Screens.js'),

	CFileModel = require('modules/FilesWebclient/js/models/CFileModel.js'),

	ShowHistoryPopup = ModulesManager.run('ActivityHistory', 'getShowHistoryPopup')
;

/**
 * @constructor
 */
function FilesSharePopup()
{
	CAbstractPopup.call(this);

	this.guestsDom = ko.observable();
	this.guestsDom.subscribe(function () {
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
	this.bSaving = ko.observable(false);
	this.sDialogHintText = ko.observable('');

	this.bAllowShowHistory = !!ShowHistoryPopup;
}

_.extendOwn(FilesSharePopup.prototype, CAbstractPopup.prototype);

FilesSharePopup.prototype.PopupTemplate = '%ModuleName%_FilesSharePopup';

/**
 *
 * @param {Object} oFileItem
 */
FilesSharePopup.prototype.onOpen = function (oFileItem)
{
	if (!_.isUndefined(oFileItem))
	{
		this.oFileItem(oFileItem);
		this.storage(oFileItem.storageType());
		this.path(oFileItem.path());
		this.id(oFileItem.id());
		this.sDialogHintText('');
		App.broadcastEvent(
			'%ModuleName%::OpenFilesSharePopup',
			{
				'DialogHintText': this.sDialogHintText,
				'IsDir': !(this.oFileItem() instanceof CFileModel)
			}
		);
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
	if (this.validateShare())
	{
		this.bSaving(true);
		this.updateShare(this.storage(), this.path(), this.id(), this.getShares());
	}
};

FilesSharePopup.prototype.onEscHandler = function ()
{
	this.cancelPopup();
};

FilesSharePopup.prototype.initInputosaurus = function (koDom, koAddr, koLockAddr)
{
	var
		fSuggestionsAutocompleteCallback = ModulesManager.run(
				'ContactsWebclient',
				'getSuggestionsAutocompleteCallback',
				[
					'team',
					App.getUserPublicId()
				]
			)
			|| function () {},
		//TODO: Remove this wrapper after adding PGP-keys to team storage
		fSuggestionsAutocompleteFilteredCallback = ModulesManager.run(
				'OpenPgpWebclient',
				'getSuggestionsAutocompleteFilteredCallback',
				[fSuggestionsAutocompleteCallback]
			),
		fCallback = fSuggestionsAutocompleteFilteredCallback ?
			fSuggestionsAutocompleteFilteredCallback
			:
			fSuggestionsAutocompleteCallback
	;

	if (koDom() && $(koDom()).length > 0)
	{
		$(koDom()).inputosaurus({
			width: 'auto',
			parseOnBlur: true,
			autoCompleteSource: fCallback,
			change : _.bind(function (ev) {
				koLockAddr(true);
				this.setRecipient(koAddr, ev.target.value);
				koLockAddr(false);
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

FilesSharePopup.prototype.updateShare = function (sStorage, sPath, sId, aShares)
{
	var
		oParameters = {
			'Storage': sStorage,
			'Path': sPath,
			'Id': sId,
			'Shares': aShares,
			'IsDir': !(this.oFileItem() instanceof CFileModel)
		},
		fOnSuccessCallback = _.bind(function () {
			Ajax.send(
				'%ModuleName%',
				'UpdateShare',
				oParameters,
				_.bind(this.onUpdateShareResponse, this)
			);
		}, this),
		fOnErrorCallback = _.bind(function () {
			this.bSaving(false);
		}, this)
	;

	var bHasSubscriber = App.broadcastEvent(
		'%ModuleName%::UpdateShare::before',
		{
			Shares: aShares,
			OnSuccessCallback: fOnSuccessCallback,
			OnErrorCallback: fOnErrorCallback,
			oFileItem: this.oFileItem(),
			IsDir: !(this.oFileItem() instanceof CFileModel)
		}
	);

	if (bHasSubscriber === false)
	{
		fCallback();
	}
};

FilesSharePopup.prototype.onUpdateShareResponse = function (oResponse, oRequest)
{
	if (oResponse.Result)
	{
		//Update shares list in oFile object
		if (!this.oFileItem().oExtendedProps)
		{
			this.oFileItem().oExtendedProps = {};
		}
		this.oFileItem().oExtendedProps.Shares = [];
		_.each(this.getShares(), _.bind(function (oShare) {
			this.oFileItem().oExtendedProps.Shares.push({
				'Access': oShare.Access,
				'PublicId': oShare.PublicId
			});
		}, this));
		if (this.oFileItem().oExtendedProps.Shares.length === 0)
		{
			this.oFileItem().isShared(false);
		}
		else
		{
			this.oFileItem().isShared(true);
		}
		Screens.showReport(TextUtils.i18n('%MODULENAME%/INFO_SHARING_STATUS_UPDATED'));
	}
	else
	{
		Api.showErrorByCode(oResponse, TextUtils.i18n('%MODULENAME%/ERROR_UNKNOWN_ERROR'));
	}
	this.bSaving(false);
	this.closePopup();
	this.oFileItem(null);
};

FilesSharePopup.prototype.validateShare = function ()
{
	var
		aGuests = _.map(AddressUtils.getArrayRecipients(this.guests(), false), function(oGuest){
			return oGuest.email;
		}),
		aOwners = _.map(AddressUtils.getArrayRecipients(this.owners(), false), function(oOwner){
			return oOwner.email;
		}),
		aDuplicateUsers = _.intersection(aGuests, aOwners)
	;

	if (aDuplicateUsers.length > 0)
	{
		Screens.showError(
			TextUtils.i18n(
				'%MODULENAME%/ERROR_DUPLICATE_USERS',
				{ 'USERNAME' : aDuplicateUsers.length > 1 ? aDuplicateUsers.join(', ') : aDuplicateUsers[0]},
				null,
				aDuplicateUsers.length
			)
		);

		return false;
	}

	return true;
};

FilesSharePopup.prototype.showHistory = function () {
	if (this.bAllowShowHistory)
	{
		Popups.showPopup(ShowHistoryPopup, [TextUtils.i18n('%MODULENAME%/HEADING_HISTORY_POPUP'), this.oFileItem()]);
	}
}

module.exports = new FilesSharePopup();
