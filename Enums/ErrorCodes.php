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
 * @copyright Copyright (c) 2023, Afterlogic Corp.
 */
class ErrorCodes
{
    public const NotPossibleToShareWithYourself	= 1000;
    public const UnknownError						= 1001;
    public const UserNotExists						= 1002;
    public const DuplicatedUsers					= 1003;
    public const NotPossibleToMoveSharedFileToSharedFolder = 1005;
    public const NotPossibleToMoveEncryptedFileToSharedFolder = 1006;
    public const NotPossibleToShareDirectoryInEcryptedStorage = 1007;
    public const IncorrectFilename = 1008;

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
        'NotPossibleToShareDirectoryInEcryptedStorage' => self::NotPossibleToShareDirectoryInEcryptedStorage,
    ];
}
