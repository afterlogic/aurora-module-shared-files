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
	this.sPublicId = Types.pString(oData.PublicId),

	this.access = ko.observable(Types.pInt(oData.Access));
	this.accessText = ko.computed(function () {
		switch (this.access()) {
			case Enums.SharedFileAccess.Reshare: return TextUtils.i18n('%MODULENAME%/LABEL_RESHARE_RIGHT');
			case Enums.SharedFileAccess.Write: return TextUtils.i18n('%MODULENAME%/LABEL_WRITE_RIGHT');
			default: return TextUtils.i18n('%MODULENAME%/LABEL_READ_RIGHT');
		}
	}, this);
}

module.exports = CShareModel;
