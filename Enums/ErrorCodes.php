<?php
/*
 * @copyright Copyright (c) 2017, Afterlogic Corp.
 * @license AGPL-3.0 or Afterlogic Software License
 *
 * This code is licensed under AGPLv3 license or Afterlogic Software License
 * if commercial version of the product was purchased.
 * For full statements of the licenses see LICENSE-AFTERLOGIC and LICENSE-AGPL3 files.
 */

namespace Aurora\Modules\SharedFiles\Enums;

class ErrorCodes
{
	const NotPossibleToShareWithYourself	= 1000;
	const UnknownError						= 1001;
	const UserNotExists						= 1002;

	/**
	 * @var array
	 */
	protected $aConsts = [
		'NotPossibleToShareWithYourself'	=> self::NotPossibleToShareWithYourself,
		'UnknownError'						=> self::UnknownError,
		'UserNotExists'						=> self::UserNotExists
	];
}
