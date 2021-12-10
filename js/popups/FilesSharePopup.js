'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),

	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),

	Ajax = require('%PathToCoreWebclientModule%/js/Ajax.js'),
	Api = require('%PathToCoreWebclientModule%/js/Api.js'),
	App = require('%PathToCoreWebclientModule%/js/App.js'),
	CAbstractPopup = require('%PathToCoreWebclientModule%/js/popups/CAbstractPopup.js'),
	ConfirmPopup = require('%PathToCoreWebclientModule%/js/popups/ConfirmPopup.js'),
	ModulesManager = require('%PathToCoreWebclientModule%/js/ModulesManager.js'),
	Popups = require('%PathToCoreWebclientModule%/js/Popups.js'),
	Screens = require('%PathToCoreWebclientModule%/js/Screens.js'),

	CShareModel = require('modules/%ModuleName%/js/models/CShareModel.js'),

	ShowHistoryPopup = ModulesManager.run('ActivityHistory', 'getShowHistoryPopup')
;

/**
 * @constructor
 */
function CFilesSharePopup()
{
	CAbstractPopup.call(this);

	this.oFileItem = null;
	this.hintText = ko.observable('');
	this.aAccessList = [
		{ value: Enums.SharedFileAccess.Read, label: TextUtils.i18n('%MODULENAME%/LABEL_READ_ACCESS') },
		{ value: Enums.SharedFileAccess.Write, label: TextUtils.i18n('%MODULENAME%/LABEL_WRITE_ACCESS') },
		{ value: Enums.SharedFileAccess.Reshare, label: TextUtils.i18n('%MODULENAME%/LABEL_RESHARE_ACCESS') }
	];

	this.shares = ko.observableArray([]);
	this.sharesScrollAreaDom = ko.observable(null);
	
	this.selectedTeammateDom = ko.observable(null);
	this.selectedTeammateData = ko.observable(null);
	this.selectedTeammateData.subscribe(function () {
		if (this.selectedTeammateData()) {
			this.shares.push(new CShareModel({
				PublicId: this.selectedTeammateData().email,
				Access: Enums.SharedFileAccess.Read
			}));
			this.selectedTeammateData(null);
			setTimeout(function () {
				if (this.selectedTeammateData() === null && this.selectedTeammateDom() !== null) {
					this.selectedTeammateDom().val('');
				}
				var
					oScrollArea = this.sharesScrollAreaDom(),
					oListArea = oScrollArea !== null ? oScrollArea.find('.shares_list') : null
				;
				if (oListArea !== null) {
					oScrollArea.scrollTop(oListArea.height() - oScrollArea.height());
				}
			}.bind(this));
		}
	}, this);

	this.sharedWithAll = ko.observable(false);
	this.sharedWithAllAccess = ko.observable(Enums.SharedFileAccess.Read);
	this.sharedWithAllAccessText = ko.computed(function () {
		switch (this.sharedWithAllAccess()) {
			case Enums.SharedFileAccess.Reshare: return TextUtils.i18n('%MODULENAME%/LABEL_RESHARE_ACCESS');
			case Enums.SharedFileAccess.Write: return TextUtils.i18n('%MODULENAME%/LABEL_WRITE_ACCESS');
			default: return TextUtils.i18n('%MODULENAME%/LABEL_READ_ACCESS');
		}
	}, this);
	
	this.permissionsWarningText = ko.computed(function () {
		var
			aLowerPermissionShares = [],
			sWarning = ''
		;
		if (this.sharedWithAll()) {
			if (this.sharedWithAllAccess() === Enums.SharedFileAccess.Write) {
				aLowerPermissionShares = _.filter(this.shares(), function (oShare) {
					return oShare.access() === Enums.SharedFileAccess.Read;
				});
			} else if (this.sharedWithAllAccess() === Enums.SharedFileAccess.Reshare) {
				aLowerPermissionShares = _.filter(this.shares(), function (oShare) {
					return oShare.access() === Enums.SharedFileAccess.Read || oShare.access() === Enums.SharedFileAccess.Write;
				});
			}
		}
		if (aLowerPermissionShares.length > 0) {
			sWarning = TextUtils.i18n('%MODULENAME%/WARNING_PERMISSIONS_UPGRADE_PLURAL', {
				'USER': aLowerPermissionShares[0].sPublicId
			}, '', aLowerPermissionShares.length);
		}
		return sWarning;
	}, this);

	this.isSaving = ko.observable(false);

	this.bAllowShowHistory = !!ShowHistoryPopup;
}

_.extendOwn(CFilesSharePopup.prototype, CAbstractPopup.prototype);

CFilesSharePopup.prototype.PopupTemplate = '%ModuleName%_FilesSharePopup';

/**
 *
 * @param {Object} oFileItem
 */
CFilesSharePopup.prototype.onOpen = function (oFileItem)
{
	this.oFileItem = oFileItem || null;
	this.hintText('');
	if (oFileItem !== null) {
		App.broadcastEvent(
			'%ModuleName%::OpenFilesSharePopup',
			{
				'DialogHintText': this.hintText,
				'IsDir': !oFileItem.IS_FILE
			}
		);

		var aSharesData = Types.pArray(oFileItem.oExtendedProps && oFileItem.oExtendedProps.Shares);
		this.shares(_.map(aSharesData, function (oShareData) {
			return new CShareModel(oShareData);
		}));
		this.sharedWithAll(!!oFileItem.oExtendedProps.SharedWithAllAccess);
		this.sharedWithAllAccess(Types.pEnum(oFileItem.oExtendedProps.SharedWithAllAccess, Enums.SharedFileAccess, Enums.SharedFileAccess.Read));
	}
};

CFilesSharePopup.prototype.getCurrentShares = function ()
{
	return _.map(this.shares(), function (oShare) {
		var iAccess = oShare.access();
		if (this.sharedWithAll()) {
			if (this.sharedWithAllAccess() === Enums.SharedFileAccess.Write && iAccess !== Enums.SharedFileAccess.Reshare) {
				iAccess = Enums.SharedFileAccess.Write;
			} else if (this.sharedWithAllAccess() === Enums.SharedFileAccess.Reshare) {
				iAccess = Enums.SharedFileAccess.Reshare;
			}
		}
		return {
			PublicId: oShare.sPublicId,
			Access: iAccess
		};
	}, this);
};

CFilesSharePopup.prototype.hasChanges = function ()
{
	var
		oFileItem = this.oFileItem,
		aSavedShares = Types.pArray(oFileItem && oFileItem.oExtendedProps && oFileItem.oExtendedProps.Shares),
		aCurrentShares = this.getCurrentShares()
	;
	aSavedShares = _.sortBy(aSavedShares, 'PublicId');
	aCurrentShares = _.sortBy(aCurrentShares, 'PublicId');
	return	oFileItem && (!_.isEqual(aSavedShares, aCurrentShares)
			|| this.sharedWithAll() !== !!oFileItem.oExtendedProps.SharedWithAllAccess
			|| this.sharedWithAllAccess() !== Types.pEnum(oFileItem.oExtendedProps.SharedWithAllAccess, Enums.SharedFileAccess, Enums.SharedFileAccess.Read));
};

CFilesSharePopup.prototype.onEscHandler = function ()
{
	this.cancelPopup();
};

CFilesSharePopup.prototype.cancelPopup = function ()
{
	if (this.isSaving()) {
		return;
	}

	if (this.hasChanges()) {
		Popups.showPopup(ConfirmPopup, [TextUtils.i18n('COREWEBCLIENT/CONFIRM_DISCARD_CHANGES'), function (bDiscard) {
			if (bDiscard) {
				this.closePopup();
			}
		}.bind(this)]);
	} else {
		this.closePopup();
	}
};

CFilesSharePopup.prototype.autocompleteCallback = function (oRequest, fResponse)
{
	var
		fSuggestionsAutocompleteCallback = ModulesManager.run('ContactsWebclient',
			'getSuggestionsAutocompleteCallback', ['team', App.getUserPublicId()]),
		fMarkRecipientsWithKeyCallback = function (aRecipientList) {
			var aFiltered = _.filter(aRecipientList, function (oSuggest) {
				return !_.find(this.shares(), function (oShare) {
					return oShare.sPublicId === oSuggest.email;
				});
			}, this);

			if (aFiltered.length > 0) {
				fResponse(aFiltered);
			} else {
				fResponse([{label: 'No available contacts found', disabled: true}]);
			}
		}.bind(this)
	;
	if (_.isFunction(fSuggestionsAutocompleteCallback)) {
		this.selectedTeammateData(null);
		fSuggestionsAutocompleteCallback(oRequest, fMarkRecipientsWithKeyCallback);
	}
};

CFilesSharePopup.prototype.deleteShare = function (sPublicId)
{
	this.shares(_.filter(this.shares(), function (oShare) {
		return oShare.sPublicId !== sPublicId;
	}));
};

CFilesSharePopup.prototype.setSharedWithAllAccess = function (iSharedWithAllAccess)
{
	this.sharedWithAllAccess(iSharedWithAllAccess);
};

CFilesSharePopup.prototype.saveShares = function ()
{
	if (this.isSaving()) {
		return;
	}

	var
		aShares = this.getCurrentShares(),
		oParameters = {
			'Storage': this.oFileItem.storageType(),
			'Path': this.oFileItem.path(),
			'Id': this.oFileItem.id(),
			'Shares': aShares,
			'SharedWithAllAccess': this.sharedWithAll() ? this.sharedWithAllAccess() : undefined,
			'IsDir': !this.oFileItem.IS_FILE
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
			this.isSaving(false);
		}, this)
	;

	this.isSaving(true);
	var bHasSubscriber = App.broadcastEvent(
		'%ModuleName%::UpdateShare::before',
		{
			Shares: aShares,
			OnSuccessCallback: fOnSuccessCallback,
			OnErrorCallback: fOnErrorCallback,
			oFileItem: this.oFileItem,
			IsDir: !this.oFileItem.IS_FILE
		}
	);

	if (bHasSubscriber === false)
	{
		fOnSuccessCallback();
	}
};

CFilesSharePopup.prototype.onUpdateShareResponse = function (oResponse, oRequest)
{
	this.isSaving(false);
	if (oResponse.Result) {
		//Update shares list in oFile object
		if (!this.oFileItem.oExtendedProps) {
			this.oFileItem.oExtendedProps = {};
		}

		this.oFileItem.oExtendedProps.Shares = oRequest.Parameters.Shares;
		this.oFileItem.oExtendedProps.SharedWithAllAccess = oRequest.Parameters.SharedWithAllAccess;

		this.oFileItem.sharedWithOthers(this.oFileItem.oExtendedProps.Shares.length > 0 || !!this.oFileItem.oExtendedProps.SharedWithAllAccess);
		Screens.showReport(TextUtils.i18n('%MODULENAME%/INFO_SHARING_STATUS_UPDATED'));
		this.oFileItem = null;
		this.closePopup();
	} else {
		Api.showErrorByCode(oResponse, TextUtils.i18n('%MODULENAME%/ERROR_UNKNOWN_ERROR'));
	}
};

CFilesSharePopup.prototype.showHistory = function () {
	if (this.bAllowShowHistory) {
		Popups.showPopup(ShowHistoryPopup, [TextUtils.i18n('%MODULENAME%/HEADING_HISTORY_POPUP'), this.oFileItem]);
	}
};

module.exports = new CFilesSharePopup();
