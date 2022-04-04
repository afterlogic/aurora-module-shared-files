<?php
/**
 * This code is licensed under AGPLv3 license or Afterlogic Software License
 * if commercial version of the product was purchased.
 * For full statements of the licenses see LICENSE-AFTERLOGIC and LICENSE-AGPL3 files.
 */

namespace Aurora\Modules\SharedFiles\Enums;

/**
 * @license https://www.gnu.org/licenses/agpl-3.0.html AGPL-3.0
 * @license https://afterlogic.com/products/common-licensing Afterlogic Software License
 * @copyright Copyright (c) 2019, Afterlogic Corp.
 */
class ErrorCodes
{
	const NotPossibleToShareWithYourself	= 1000;
	const UnknownError						= 1001;
	const UserNotExists						= 1002;
	const DuplicatedUsers					= 1003;
	const NotPossibleToMoveSharedFileToSharedFolder = 1005;
	const NotPossibleToMoveEncryptedFileToSharedFolder = 1006;
	const NotPossibleToShareDirectoryInEcryptedStorage = 1007;
	const IncorrectFilename = 1008;

	/**
	 * @var array
	 */
	protected $aConsts = [
		'NotPossibleToShareWithYourself'	=> self::NotPossibleToShareWithYourself,
		'UnknownError'						=> self::UnknownError,
		'UserNotExists'						=> self::UserNotExists,
		'DuplicatedUsers'					=> self::DuplicatedUsers,
		'NotPossibleToMoveSharedFileToSharedFolder'	=> self::NotPossibleToMoveSharedFileToSharedFolder,
		'NotPossibleToMoveEncryptedFileToSharedFolder' => self::NotPossibleToMoveEncryptedFileToSharedFolder,
		'NotPossibleToShareDirectoryInEcryptedStorage' => self::NotPossibleToShareDirectoryInEcryptedStorage
	];
}
