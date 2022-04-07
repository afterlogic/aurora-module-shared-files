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

	this.fileItem = null;
	this.isFileEncrypted = false;
	this.hintText = ko.observable('');
	this.accessList = ko.computed(function () {
		return [
			{ value: Enums.SharedFileAccess.Read, label: TextUtils.i18n('%MODULENAME%/LABEL_READ_ACCESS') },
			{ value: Enums.SharedFileAccess.Write, label: TextUtils.i18n('%MODULENAME%/LABEL_WRITE_ACCESS') },
			{ value: Enums.SharedFileAccess.Reshare, label: TextUtils.i18n('%MODULENAME%/LABEL_RESHARE_ACCESS') },
			{ value: Enums.SharedFileAccess.NoAccess, label: TextUtils.i18n('%MODULENAME%/LABEL_NOSHARE_ACCESS') }
		];
	}, this);

	this.shares = ko.observableArray([]);
	this.sharesScrollAreaDom = ko.observable(null);

	this.selectedTeammateDom = ko.observable(null);
	this.selectedTeammateDom.subscribe(function () {
		this.selectedTeammateDom().on('click', function() {
			if (this.selectedTeammateEmail() !== '') {
				if (!$(this.selectedTeammateDom().autocomplete('widget')).is(':visible')) {
					this.selectedTeammateDom().autocomplete('search');
				}
			}
		}.bind(this));
	}, this);
	this.selectedTeammateEmail = ko.observable('');
	this.selectedTeammateData = ko.observable(null);
	this.selectedTeammateData.subscribe(function () {
		if (this.selectedTeammateData()) {
			this.selectedTeammateEmail(this.selectedTeammateData().email);
		}
	}, this);

	this.selectAccessDom = ko.observable(null);
	this.lastRecievedSuggestList = [];

	this.isSaving = ko.observable(false);
	this.loadingFileShares = ko.observable(false);

	this.bAllowShowHistory = !!ShowHistoryPopup;
}

_.extendOwn(CFilesSharePopup.prototype, CAbstractPopup.prototype);

CFilesSharePopup.prototype.PopupTemplate = '%ModuleName%_FilesSharePopup';

/**
 * @param {object} fileItem
 * @param {function} expungeFileItems
 */
CFilesSharePopup.prototype.onOpen = function (fileItem = null, expungeFileItems = null)
{
	if (fileItem === null) {
		this.closePopup();
		return;
	}

	this.fileItem = fileItem;
	const extendedProps = fileItem && fileItem.oExtendedProps;
	this.isFileEncrypted = !!(fileItem.oExtendedProps && fileItem.oExtendedProps.InitializationVector);
	this.expungeFileItems = expungeFileItems;

	this.hintText('');
	this.selectedTeammateEmail('');
	this.selectedTeammateData(null);

	App.broadcastEvent(
		'%ModuleName%::OpenFilesSharePopup',
		{
			'DialogHintText': this.hintText,
			'IsDir': !fileItem.IS_FILE
		}
	);

	this.fillUpShares();
	this.requestFileShares(function (sharedWithMeAccess, shares) {
		this.updateFileShares(sharedWithMeAccess, shares);
		this.fillUpShares();
	}.bind(this));
};

CFilesSharePopup.prototype.fillUpShares = function ()
{
	const
		extendedProps = this.fileItem && this.fileItem.oExtendedProps,
		sharesData = Types.pArray(extendedProps && extendedProps.Shares)
	;
	this.shares(_.map(sharesData, function (shareData) {
		return new CShareModel(shareData);
	}));
};

CFilesSharePopup.prototype.requestFileShares = function (callback)
{
	const fileItem = this.fileItem;
	const parameters = {
		'Type': fileItem.storageType(),
		'Path': fileItem.path(),
		'Name': fileItem.fileName()
	};
	this.loadingFileShares(true);
	Ajax.send(
		'Files',
		'GetExtendedProps',
		parameters,
		function (response, request) {
			this.loadingFileShares(false);
			if (response && response.Result && response.Result.Shares) {
				const sharedWithMeAccess = Types.pEnum(response.Result.SharedWithMeAccess,
						Enums.SharedFileAccess, Enums.SharedFileAccess.NoAccess);
				callback(sharedWithMeAccess, response.Result.Shares);
			} else {
				callback(Enums.SharedFileAccess.NoAccess, []);
			}
		}.bind(this)
	);
};

CFilesSharePopup.prototype.updateFileShares = function (newSharedWithMeAccess, newShares)
{
	if (!this.fileItem) {
		return;
	}

	//Update shares list in oFile object
	const
		extendedProps = this.fileItem.oExtendedProps,
		oldSharedWithMeAccess = Types.pInt(extendedProps && extendedProps.SharedWithMeAccess)
	;
	if (oldSharedWithMeAccess !== newSharedWithMeAccess) {
		if (this.fileItem.sharedWithMe() && newSharedWithMeAccess === Enums.SharedFileAccess.NoAccess) {
			this.fileItem.deleted(true);
			if (_.isFunction(this.expungeFileItems)) {
				this.expungeFileItems();
			}
			this.closePopup();
			return;
		}
	}
	this.fileItem.updateExtendedProps({
		'SharedWithMeAccess': newSharedWithMeAccess,
		'Shares': Types.pArray(newShares)
	});
	if (this.fileItem.sharedWithMe() && !this.fileItem.sharedWithMeAccessReshare()) {
		this.closePopup();
	}
};

CFilesSharePopup.prototype.getCurrentShares = function ()
{
	return _.map(this.shares(), function (share) {
		const access = share.access();
		if (share.groupId) {
			return {
				PublicId: share.publicId,
				Access: access,
				IsAll: share.isAllUsersGroup,
				IsGroup: true,
				GroupId: share.groupId
			};
		} else {
			const state = {
				PublicId: share.publicId,
				Access: access
			};
			if (this.isFileEncrypted && share.isNew) {
				state.New = true;
			}
			return state;
		}
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
	return fileItem && (!_.isEqual(savedShares, currentShares) || this.selectedTeammateEmail());
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
	const fileItem = this.fileItem;
	if (!this.fileItem) {
		fResponse([]);
		return;
	}

	const
		suggestParameters = {
			storage: 'team',
			addContactGroups: false,
			addUserGroups: !this.isFileEncrypted,
			exceptEmail: this.fileItem.sOwnerName
		},
		autocompleteCallback = ModulesManager.run(
			'ContactsWebclient', 'getSuggestionsAutocompleteCallback', [suggestParameters]
		),
		markRecipientsWithKeyCallback = function (recipientList) {
			const ownerLowerCase = fileItem.sOwnerName.toLowerCase();
			let filteredList = this.isFileEncrypted
				? recipientList.filter(suggestion => suggestion.hasKey)
				: recipientList;
			filteredList = filteredList.filter(suggestion => {
				const emailLowerCase = suggestion.email.toLowerCase();
				return ownerLowerCase !== emailLowerCase &&
						!this.shares().find(share => share.publicId.toLowerCase() === emailLowerCase);
			});
			this.lastRecievedSuggestList = filteredList;

			if (filteredList.length > 0) {
				response(filteredList);
			} else {
				const langConst = this.isFileEncrypted
					? 'INFO_NO_SUGGESTED_CONTACTS_WITH_PGPKEY'
					: 'INFO_NO_SUGGESTED_CONTACTS';
				response([{label: TextUtils.i18n(`%MODULENAME%/${langConst}`), disabled: true}]);
			}
		}.bind(this)
	;
	if (_.isFunction(autocompleteCallback)) {
		this.selectedTeammateData(null);
		autocompleteCallback(request, markRecipientsWithKeyCallback);
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
				enteredTeammate = this.selectedTeammateEmail(),
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
					return data.value.toLowerCase() === enteredTeammateLower
							|| data.email.toLowerCase() === enteredTeammateLower
							|| data.name.toLowerCase() === enteredTeammateLower;
				}.bind(this));
				if (teammateData) {
					this.selectedTeammateData(teammateData);
				} else {
					teammateData = _.find(this.lastRecievedSuggestList, function (data) {
						return data.value.toLowerCase().indexOf(enteredTeammateLower) !== -1;
					}.bind(this));
					if (teammateData) {
						var
							confirmText = TextUtils.i18n('%MODULENAME%/CONFIRM_ADD_TEAMMATE', {'EMAIL': teammateData.email}),
							confirmCallback = function (addConfirmed) {
								if (addConfirmed) {
									this.selectedTeammateEmail(teammateData.email);
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
		GroupId: this.selectedTeammateData().groupId,
		IsAll: this.selectedTeammateData().isAllUsersGroup,
		Access: access,
		New: true
	}));

	this.selectedTeammateData(null);
	this.selectedTeammateEmail('');
	var
		scrollArea = this.sharesScrollAreaDom(),
		listArea = scrollArea !== null ? scrollArea.find('.shares_list') : null
	;
	if (listArea !== null) {
		scrollArea.scrollTop(listArea.height() - scrollArea.height());
	}
};

CFilesSharePopup.prototype.deleteShare = function (publicId, groupId)
{
	if (groupId) {
		this.shares(_.filter(this.shares(), function (share) {
			return share.groupId !== groupId;
		}));
	} else {
		this.shares(_.filter(this.shares(), function (share) {
			return share.publicId !== publicId;
		}));
	}
};

CFilesSharePopup.prototype.checkAndSaveShares = function ()
{
	if (this.isSaving()) {
		return;
	}

	this.isSaving(true);
	this.requestFileShares(function (sharedWithMeAccessFromServer, sharesFromServer) {
		this.isSaving(false);
		const fileItem = this.fileItem;
		let
			extendedProps = fileItem && fileItem.oExtendedProps,
			savedShares = Types.pArray(extendedProps && extendedProps.Shares),
			sharedWithMeAccess = Types.pInt(extendedProps && extendedProps.SharedWithMeAccess)
		;
		sharesFromServer = _.sortBy(sharesFromServer, 'PublicId');
		savedShares = _.sortBy(savedShares, 'PublicId');
		if (_.isEqual(savedShares, sharesFromServer) && sharedWithMeAccessFromServer === sharedWithMeAccess) {
			this.saveShares();
		} else {
			const
				alertText = TextUtils.i18n('%MODULENAME%/WARNING_SHARES_CHANGED_BY_OTHER_USER'),
				alertCallback = function () {
					this.updateFileShares(sharedWithMeAccessFromServer, sharesFromServer);
					this.fillUpShares();
				}.bind(this)
			;
			Popups.showPopup(AlertPopup, [alertText, alertCallback]);
		}
	}.bind(this));
};

CFilesSharePopup.prototype.saveShares = function ()
{
	if (this.isSaving()) {
		return;
	}

	if (this.selectedTeammateEmail()) {
		var
			confirmText = TextUtils.i18n('%MODULENAME%/CONFIRM_SAVE_SHARES_WITHOUT_LAST_EMAIL', { 'EMAIL': this.selectedTeammateEmail() }),
			confirmCallback = function (saveConfirmed) {
				if (saveConfirmed) {
					this.confirmedSaveShares();
				} else {
					setTimeout(this.selectAccess.bind(this));
				}
			}.bind(this)
		;
		Popups.showPopup(ConfirmPopup, [confirmText, confirmCallback]);
	} else {
		this.confirmedSaveShares();
	}

};

CFilesSharePopup.prototype.confirmedSaveShares = function ()
{
	if (this.isSaving()) {
		return;
	}

	var
		shares = this.getCurrentShares(),
		parameters = {
			'Storage': this.fileItem.storageType(),
			'Path': this.fileItem.path(),
			'Id': this.fileItem.id(),
			'Shares': shares,
			'IsDir': !this.fileItem.IS_FILE
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
			FileItem: this.fileItem,
			Shares: shares,
			OnSuccessCallback: fOnSuccessCallback,
			OnErrorCallback: fOnErrorCallback
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
		this.requestFileShares(function (sharedWithMeAccess, shares) {
			this.updateFileShares(sharedWithMeAccess, shares);
			Screens.showReport(TextUtils.i18n('%MODULENAME%/INFO_SHARING_STATUS_UPDATED'));
			this.fileItem = null;
			this.closePopup();
		}.bind(this));
	} else {
		Api.showErrorByCode(response, TextUtils.i18n('%MODULENAME%/ERROR_UNKNOWN_ERROR'));
	}
};

CFilesSharePopup.prototype.showHistory = function () {
	if (this.bAllowShowHistory) {
		Popups.showPopup(ShowHistoryPopup, [TextUtils.i18n('%MODULENAME%/HEADING_HISTORY_POPUP'), this.fileItem]);
	}
};

module.exports = new CFilesSharePopup();
