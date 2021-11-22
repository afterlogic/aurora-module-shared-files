'use strict';

var
	_ = require('underscore'),
	Enums = {}
;

/**
 * @enum {number}
 */
Enums.SharedFileAccess = {
	'Write': 1,
	'Read': 2,
	'Reshare': 3
};

if (typeof window.Enums === 'undefined')
{
	window.Enums = {};
}

_.extendOwn(window.Enums, Enums);
