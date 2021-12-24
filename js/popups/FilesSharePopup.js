'use strict';

var
	_ = require('underscore'),
	ko = require('knockout'),

	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js'),

	Ajax = require('%PathToCoreWebclientModule%/js/Ajax.js'),
	AlertPopup = require('%PathToCoreWebclientModule%/js/popups/AlertPopup.js'),
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
	this.selectedTeammateDom.subscribe(function () {
		this.selectedTeammateDom().on('click', function() {
			if (this.selectedTeammateDom().val() !== '') {
				if (!$(this.selectedTeammateDom().autocomplete('widget')).is(':visible')) {
					this.selectedTeammateDom().autocomplete('search');
				}
			}
		}.bind(this));
	}, this);
	this.selectedTeammateData = ko.observable(null);

	this.selectAccessDom = ko.observable(null);
	this.lastRecievedSuggestList = [];

	this.sharedWithAll = ko.observable(false);
	this.sharedWithAllAccess = ko.observable(Enums.SharedFileAccess.Read);
	this.sharedWithAllAccessText = ko.computed(function () {
		switch (this.sharedWithAllAccess()) {
			case Enums.SharedFileAccess.Reshare: return TextUtils.i18n('%MODULENAME%/LABEL_RESHARE_ACCESS');
			case Enums.SharedFileAccess.Write: return TextUtils.i18n('%MODULENAME%/LABEL_WRITE_ACCESS');
			default: return TextUtils.i18n('%MODULENAME%/LABEL_READ_ACCESS');
		}
	}, this);
	
	this.isSaving = ko.observable(false);

	this.bAllowShowHistory = !!ShowHistoryPopup;
}

_.extendOwn(CFilesSharePopup.prototype, CAbstractPopup.prototype);

CFilesSharePopup.prototype.PopupTemplate = '%ModuleName%_FilesSharePopup';

/**
 *
 * @param {Object} fileItem
 */
CFilesSharePopup.prototype.onOpen = function (fileItem)
{
	this.oFileItem = fileItem || null;
	this.hintText('');
	if (fileItem !== null) {
		App.broadcastEvent(
			'%ModuleName%::OpenFilesSharePopup',
			{
				'DialogHintText': this.hintText,
				'IsDir': !fileItem.IS_FILE
			}
		);

		var sharesData = Types.pArray(fileItem.oExtendedProps && fileItem.oExtendedProps.Shares);
		this.shares(_.map(sharesData, function (shareData) {
			return new CShareModel(shareData);
		}));
		this.sharedWithAll(!!fileItem.oExtendedProps.SharedWithAllAccess);
		this.sharedWithAllAccess(Types.pEnum(fileItem.oExtendedProps.SharedWithAllAccess, Enums.SharedFileAccess, Enums.SharedFileAccess.Read));
	}
};

CFilesSharePopup.prototype.getCurrentShares = function ()
{
	return _.map(this.shares(), function (share) {
		var access = share.access();
		if (this.sharedWithAll()) {
			if (this.sharedWithAllAccess() === Enums.SharedFileAccess.Write && access !== Enums.SharedFileAccess.Reshare) {
				access = Enums.SharedFileAccess.Write;
			} else if (this.sharedWithAllAccess() === Enums.SharedFileAccess.Reshare) {
				access = Enums.SharedFileAccess.Reshare;
			}
		}
		return {
			PublicId: share.sPublicId,
			Access: access
		};
	}, this);
};

CFilesSharePopup.prototype.hasChanges = function ()
{
	var
		fileItem = this.fileItem,
		savedShares = Types.pArray(fileItem && fileItem.oExtendedProps && fileItem.oExtendedProps.Shares),
		currentShares = this.getCurrentShares()
	;
	savedShares = _.sortBy(savedShares, 'PublicId');
	currentShares = _.sortBy(currentShares, 'PublicId');
	return	fileItem && (!_.isEqual(savedShares, currentShares)
			|| this.sharedWithAll() !== !!fileItem.oExtendedProps.SharedWithAllAccess
			|| this.sharedWithAllAccess() !== Types.pEnum(fileItem.oExtendedProps.SharedWithAllAccess, Enums.SharedFileAccess, Enums.SharedFileAccess.Read));
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
		Popups.showPopup(ConfirmPopup, [TextUtils.i18n('COREWEBCLIENT/CONFIRM_DISCARD_CHANGES'), function (discardConfirmed) {
			if (discardConfirmed) {
				this.closePopup();
			}
		}.bind(this)]);
	} else {
		this.closePopup();
	}
};

CFilesSharePopup.prototype.autocompleteCallback = function (request, response)
{
	var
		suggestionsAutocompleteCallback = ModulesManager.run('ContactsWebclient',
			'getSuggestionsAutocompleteCallback', ['team', App.getUserPublicId()]),
		markRecipientsWithKeyCallback = function (recipientList) {
			this.lastRecievedSuggestList = recipientList;

			var filteredList = _.filter(recipientList, function (suggest) {
				return !_.find(this.shares(), function (share) {
					return share.sPublicId === suggest.email;
				});
			}, this);

			if (filteredList.length > 0) {
				response(filteredList);
			} else {
				response([{label: TextUtils.i18n('%MODULENAME%/INFO_NO_SUGGESTED_CONTACTS'), disabled: true}]);
			}
		}.bind(this)
	;
	if (_.isFunction(suggestionsAutocompleteCallback)) {
		this.selectedTeammateData(null);
		suggestionsAutocompleteCallback(request, markRecipientsWithKeyCallback);
	}
};

CFilesSharePopup.prototype.selectAccess = function (hasExpandClass, control)
{
	var hasExpandClass = this.selectAccessDom().hasClass('expand');
	if (hasExpandClass) {
		this.selectAccessDom().removeClass('expand');
	} else {
		if (this.selectedTeammateData() === null) {
			var
				enteredTeammate = this.selectedTeammateDom().val(),
				enteredTeammateLower = enteredTeammate.toLowerCase()
			;
			if (enteredTeammate === '') {
				var
					alertText = TextUtils.i18n('%MODULENAME%/WARNING_SELECT_TEAMMATE'),
					alertCallback = function () {
						this.selectedTeammateDom().focus();
						this.selectedTeammateDom().autocomplete('option', 'minLength', 0); //for triggering search on empty field
						this.selectedTeammateDom().autocomplete('search');
						this.selectedTeammateDom().autocomplete('option', 'minLength', 1);
					}.bind(this)
				;
				Popups.showPopup(AlertPopup, [alertText, alertCallback]);
			} else {
				var teammateData = _.find(this.lastRecievedSuggestList, function (data) {
					return (data.value.toLowerCase() === enteredTeammateLower
							|| data.email.toLowerCase() === enteredTeammateLower
							|| data.name.toLowerCase() === enteredTeammateLower)
							&& !_.find(this.shares(), function (share) {
								return share.sPublicId.toLowerCase() === data.email.toLowerCase();
							});
				}.bind(this));
				if (teammateData) {
					this.selectedTeammateData(teammateData);
				} else {
					teammateData = _.find(this.lastRecievedSuggestList, function (data) {
						return data.value.toLowerCase().indexOf(enteredTeammateLower) !== -1
								&& !_.find(this.shares(), function (share) {
									return share.sPublicId.toLowerCase() === data.email.toLowerCase();
								});
					}.bind(this));
					if (teammateData) {
						var
							confirmText = TextUtils.i18n('%MODULENAME%/CONFIRM_ADD_TEAMMATE', {'EMAIL': teammateData.email}),
							confirmCallback = function (addConfirmed) {
								if (addConfirmed) {
									this.selectedTeammateDom().val(teammateData.email);
									this.selectedTeammateData(teammateData);
									this.selectAccessDom().addClass('expand');
								} else {
									this.selectedTeammateDom().focus();
									this.selectedTeammateDom().autocomplete('search');
								}
							}.bind(this),
							yesButtonText = TextUtils.i18n('%MODULENAME%/ACTION_YES'),
							noButtonText = TextUtils.i18n('%MODULENAME%/ACTION_NO')
						;
						Popups.showPopup(ConfirmPopup, [confirmText, confirmCallback, '', yesButtonText, noButtonText]);
					} else {
						var
							alertText = TextUtils.i18n('%MODULENAME%/WARNING_NO_TEAMMATE_SELECTED', {'EMAIL': enteredTeammate}),
							alertCallback = function () {
								this.selectedTeammateDom().focus();
								this.selectedTeammateDom().autocomplete('search');
							}.bind(this)
						;
						Popups.showPopup(AlertPopup, [alertText, alertCallback]);
					}
				}
			}
		}
		if (this.selectedTeammateData() !== null) {
			this.selectAccessDom().addClass('expand');
		}
	}
};

CFilesSharePopup.prototype.addNewShare = function (access)
{
	if (!this.selectedTeammateData()) {
		this.selectedTeammateDom().focus();
		this.selectedTeammateDom().autocomplete('search');
		return;
	}

	this.shares.push(new CShareModel({
		PublicId: this.selectedTeammateData().email,
		Access: access
	}));

	this.selectedTeammateData(null);
	this.selectedTeammateDom().val('');
	var
		scrollArea = this.sharesScrollAreaDom(),
		listArea = scrollArea !== null ? scrollArea.find('.shares_list') : null
	;
	if (listArea !== null) {
		scrollArea.scrollTop(listArea.height() - scrollArea.height());
	}
};

CFilesSharePopup.prototype.deleteShare = function (publicId)
{
	this.shares(_.filter(this.shares(), function (share) {
		return share.sPublicId !== publicId;
	}));
};

CFilesSharePopup.prototype.setSharedWithAllAccess = function (sharedWithAllAccess)
{
	var lowerPermissionShares = [];
	if (this.sharedWithAll()) {
		if (sharedWithAllAccess === Enums.SharedFileAccess.Write) {
			lowerPermissionShares = _.filter(this.shares(), function (share) {
				return share.access() === Enums.SharedFileAccess.Read;
			});
		} else if (sharedWithAllAccess === Enums.SharedFileAccess.Reshare) {
			lowerPermissionShares = _.filter(this.shares(), function (share) {
				return share.access() === Enums.SharedFileAccess.Read || share.access() === Enums.SharedFileAccess.Write;
			});
		}
	}
	if (lowerPermissionShares.length > 0) {
		var confirmText = TextUtils.i18n('%MODULENAME%/WARNING_PERMISSIONS_UPGRADE_PLURAL', {
			'USER': lowerPermissionShares[0].sPublicId
		}, '', lowerPermissionShares.length);
		Popups.showPopup(ConfirmPopup, [confirmText, function (upgradeConfirmed) {
			if (upgradeConfirmed) {
				this.sharedWithAllAccess(sharedWithAllAccess);
				_.each(lowerPermissionShares, function (share) {
					share.access(sharedWithAllAccess);
				}, this);
			}
		}.bind(this), '', TextUtils.i18n('%MODULENAME%/ACTION_UPGRADE_PERMISSIONS')]);
	} else {
		this.sharedWithAllAccess(sharedWithAllAccess);
	}
};

CFilesSharePopup.prototype.saveShares = function ()
{
	if (this.isSaving()) {
		return;
	}

	var
		shares = this.getCurrentShares(),
		parameters = {
			'Storage': this.oFileItem.storageType(),
			'Path': this.oFileItem.path(),
			'Id': this.oFileItem.id(),
			'Shares': shares,
			'SharedWithAllAccess': this.sharedWithAll() ? this.sharedWithAllAccess() : undefined,
			'IsDir': !this.oFileItem.IS_FILE
		},
		fOnSuccessCallback = _.bind(function () {
			Ajax.send(
				'%ModuleName%',
				'UpdateShare',
				parameters,
				_.bind(this.onUpdateShareResponse, this)
			);
		}, this),
		fOnErrorCallback = _.bind(function () {
			this.isSaving(false);
		}, this)
	;

	this.isSaving(true);
	var hasSubscriber = App.broadcastEvent(
		'%ModuleName%::UpdateShare::before',
		{
			Shares: shares,
			OnSuccessCallback: fOnSuccessCallback,
			OnErrorCallback: fOnErrorCallback,
			oFileItem: this.oFileItem,
			IsDir: !this.oFileItem.IS_FILE
		}
	);

	if (hasSubscriber === false) {
		fOnSuccessCallback();
	}
};

CFilesSharePopup.prototype.onUpdateShareResponse = function (response, request)
{
	this.isSaving(false);
	if (response.Result) {
		//Update shares list in oFile object
		if (!this.oFileItem.oExtendedProps) {
			this.oFileItem.oExtendedProps = {};
		}

		this.oFileItem.oExtendedProps.Shares = request.Parameters.Shares;
		this.oFileItem.oExtendedProps.SharedWithAllAccess = request.Parameters.SharedWithAllAccess;

		this.oFileItem.sharedWithOthers(this.oFileItem.oExtendedProps.Shares.length > 0 || !!this.oFileItem.oExtendedProps.SharedWithAllAccess);
		Screens.showReport(TextUtils.i18n('%MODULENAME%/INFO_SHARING_STATUS_UPDATED'));
		this.oFileItem = null;
		this.closePopup();
	} else {
		Api.showErrorByCode(response, TextUtils.i18n('%MODULENAME%/ERROR_UNKNOWN_ERROR'));
	}
};

CFilesSharePopup.prototype.showHistory = function () {
	if (this.bAllowShowHistory) {
		Popups.showPopup(ShowHistoryPopup, [TextUtils.i18n('%MODULENAME%/HEADING_HISTORY_POPUP'), this.oFileItem]);
	}
};

module.exports = new CFilesSharePopup();
