'use strict';

var
	ko = require('knockout'),

	TextUtils = require('%PathToCoreWebclientModule%/js/utils/Text.js'),
	Types = require('%PathToCoreWebclientModule%/js/utils/Types.js')
;

/**
 * @constructor
 * @param {object} oData
 */
function CShareModel(oData)
{
	this.publicId = Types.pString(oData.PublicId);
	this.groupId = Types.pInt(oData.GroupId);
	this.isAllUsersGroup = Types.pBool(oData.IsAll);
	this.isNew = Types.pBool(oData.New);

	this.access = ko.observable(Types.pInt(oData.Access));
	this.accessText = ko.computed(function () {
		switch (this.access()) {
			case Enums.SharedFileAccess.Reshare: return TextUtils.i18n('%MODULENAME%/LABEL_RESHARE_ACCESS');
			case Enums.SharedFileAccess.Write: return TextUtils.i18n('%MODULENAME%/LABEL_WRITE_ACCESS');
			case Enums.SharedFileAccess.Read: return TextUtils.i18n('%MODULENAME%/LABEL_READ_ACCESS');
			default: return TextUtils.i18n('%MODULENAME%/LABEL_NOSHARE_ACCESS');
		}
	}, this);
}

module.exports = CShareModel;
