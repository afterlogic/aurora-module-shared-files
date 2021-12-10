<?php
/**
 * This code is licensed under AGPLv3 license or Afterlogic Software License
 * if commercial version of the product was purchased.
 * For full statements of the licenses see LICENSE-AFTERLOGIC and LICENSE-AGPL3 files.
 */

namespace Aurora\Modules\SharedFiles;

use Afterlogic\DAV\FS\Directory;
use Afterlogic\DAV\FS\File;
use Afterlogic\DAV\FS\Shared\Root;
use Afterlogic\DAV\Server;
use Aurora\Api;
use Aurora\Modules\Core\Module as CoreModule;
use Aurora\System\Enums\FileStorageType;

use function Sabre\Uri\split;

/**
 * @license https://www.gnu.org/licenses/agpl-3.0.html AGPL-3.0
 * @license https://afterlogic.com/products/common-licensing Afterlogic Software License
 * @copyright Copyright (c) 2019, Afterlogic Corp.
 *
 * @package Modules
 */
class Module extends \Aurora\Modules\PersonalFiles\Module
{
	/**
	 *
	 */
	protected static $sStorageType = 'shared';

	/**
	 *
	 * @var integer
	 */
	protected static $iStorageOrder = 30;

	/**
	 * Indicates if it's allowed to move files/folders to this storage.
	 * @var type bool
	 */
	protected static $bIsDroppable = false;

	/**
	 *
	 */
	protected $oBackend;

	protected $oBeforeDeleteUser = null;

	public function getManager()
	{
		if ($this->oManager === null)
		{
			$this->oManager = new Manager($this);
		}

		return $this->oManager;
	}

	public function init()
	{
		parent::init();

		$this->oBackend = new \Afterlogic\DAV\FS\Backend\PDO();

		$this->aErrors = [
			Enums\ErrorCodes::NotPossibleToShareWithYourself	=> $this->i18N('ERROR_NOT_POSSIBLE_TO_SHARE_WITH_YOURSELF'),
			Enums\ErrorCodes::UnknownError				=> $this->i18N('ERROR_UNKNOWN_ERROR'),
			Enums\ErrorCodes::UserNotExists				=> $this->i18N('ERROR_USER_NOT_EXISTS'),
			Enums\ErrorCodes::DuplicatedUsers			=> $this->i18N('ERROR_DUPLICATE_USERS_BACKEND')
		];

		$this->subscribeEvent('Files::GetFiles::after', array($this, 'onAfterGetFiles'));
		$this->subscribeEvent('Files::GetItems::after', array($this, 'onAfterGetItems'), 10000);
	}

	/**
	 * @ignore
	 * @param array $aArgs Arguments of event.
	 * @param mixed $mResult Is passed by reference.
	 */
	public function onAfterGetItems($aArgs, &$mResult)
	{
		if (is_array($mResult))
		{
			foreach ($mResult as $oItem)
			{
				$oExtendedProps = $oItem->ExtendedProps;
				$bSharedWithMe = isset($oExtendedProps['SharedWithMeAccess']) ? $oExtendedProps['SharedWithMeAccess'] : false;
				$oExtendedProps['Shares'] = $this->GetShares($aArgs['UserId'], $aArgs['Type'], \rtrim($oItem->Path, '/') . '/' . $oItem->Id, $bSharedWithMe);
				$oItem->ExtendedProps = $oExtendedProps;
			}
		}
	}

	protected function isNeedToReturnBody()
	{
		$sMethod = $this->oHttp->GetPost('Method', null);

        return ((string) \Aurora\System\Router::getItemByIndex(2, '') === 'thumb' ||
			$sMethod === 'SaveFilesAsTempFiles' ||
			$sMethod === 'GetFilesForUpload'
		);
	}

	protected function isNeedToReturnWithContectDisposition()
	{
		$sAction = (string) \Aurora\System\Router::getItemByIndex(2, 'download');
        return $sAction ===  'download';
	}

	public function GetShares($UserId, $Storage, $Path, $SharedWithMe = false)
	{
		$aResult = [];

		$sUserPublicId = \Aurora\System\Api::getUserPublicIdById($UserId);
		Server::checkPrivileges('files/' . $Storage . '/' . \ltrim($Path, '/'), '{DAV:}write-acl');
		$aShares = $this->oBackend->getShares('principals/' . $sUserPublicId, $Storage, '/' . \ltrim($Path, '/'));
		if (!$aShares && $SharedWithMe) {
			list($sPath, $sName) = split($Path);
			$aSharedFile = $this->oBackend->getSharedFileByUidWithPath('principals/' . $sUserPublicId, $sName, $sPath);
			if ($aSharedFile) {
				$aShares = $this->oBackend->getShares($aSharedFile['owner'], $aSharedFile['storage'], $aSharedFile['path']);
			}
		}
		foreach ($aShares as $aShare)
		{
			$aResult[] = [
				'PublicId' => basename($aShare['principaluri']),
				'Access' => $aShare['access']
			];
		}

		return $aResult;
	}

	/**
	 * @param \Aurora\Modules\StandardAuth\Classes\Account $oAccount
	 * @param int $iType
	 * @param string $sPath
	 * @param string $sFileName
	 *
	 * @return string
	 */
	public function getNonExistentFileName($principalUri, $sFileName, $sPath = '')
	{
		$iIndex = 0;
		$sFileNamePathInfo = pathinfo($sFileName);
		$sExt = '';
		$sNameWOExt = $sFileName;
		if (isset($sFileNamePathInfo['extension']))
		{
			$sExt = '.'.$sFileNamePathInfo['extension'];
		}

		if (isset($sFileNamePathInfo['filename']))
		{
			$sNameWOExt = $sFileNamePathInfo['filename'];
		}

		while ($this->oBackend->getSharedFileByUidWithPath($principalUri, $sFileName, $sPath))
		{
			$sFileName = $sNameWOExt.' ('.$iIndex.')'.$sExt;
			$iIndex++;
		}
		list(, $sUserPublicId) = \Sabre\Uri\split($principalUri);
		$oUser = CoreModule::getInstance()->GetUserByPublicId($sUserPublicId);

		if ($oUser) {
			$sPrevState = Api::skipCheckUserRole(true);
			$sFileName = \Aurora\Modules\Files\Module::Decorator()->GetNonExistentFileName(
				$oUser->Id,
				FileStorageType::Personal,
				$sPath,
				$sFileName
			);
			Api::skipCheckUserRole($sPrevState);
		}

		return $sFileName;
	}


	public function UpdateShare($UserId, $Storage, $Path, $Id, $Shares, $IsDir = false)
	{
		$mResult = true;
		$aGuests = [];
		$aOwners = [];
		$aReshare = [];
		$aUpdateShares = [];

		$oUser = \Aurora\System\Api::getAuthenticatedUser();
		if ($oUser instanceof \Aurora\Modules\Core\Models\User)
		{
			$sUserPublicId = \Aurora\System\Api::getUserPublicIdById($UserId);
			$FullPath =  $Path . '/' . $Id;
			Server::checkPrivileges('files/' . $Storage . '/' . \ltrim($FullPath, '/'), '{DAV:}write-acl');
			$oNode = Server::getNodeForPath('files/' . $Storage . '/' . \ltrim($FullPath, '/'));
			$bIsShared = ($oNode instanceof \Afterlogic\DAV\FS\Shared\File || $oNode instanceof \Afterlogic\DAV\FS\Shared\Directory);
			if ($bIsShared) {
				$sUserPublicId = $oNode->getOwnerPublicId();
				$ParentNode = $oNode->getNode();
				$FullPath = $ParentNode->getRelativePath() . '/' . $ParentNode->getName();
				$Storage = $oNode->getStorage();
			}
			$aShares = $this->oBackend->getShares('principals/' . $sUserPublicId, $Storage, '/' . \ltrim($FullPath, '/'));
			
			$aOldSharePrincipals = array_map(function ($aShareItem) {
				return $aShareItem['principaluri'];
			}, $aShares);
			
			$aNewSharePrincipals = array_map(function ($aShareItem) {
				return 'principals/' . $aShareItem['PublicId'];
			}, $Shares);

			$aItemsToDelete = array_diff(
				$aOldSharePrincipals,
				$aNewSharePrincipals
			);
			foreach ($aItemsToDelete as $sItem) {
				$mResult = $this->oBackend->deleteSharedFileByPrincipalUri($sItem, $Storage, $FullPath);
			}

			$aItemsToCreate = array_diff(
				$aNewSharePrincipals,
				$aOldSharePrincipals
			);

			$aItemsToUpdate = array_intersect(
				$aOldSharePrincipals,
				$aNewSharePrincipals
			);

			foreach ($Shares as $Share) {
				if (!$bIsShared && $oUser->PublicId === $Share['PublicId']) {
					throw new \Aurora\System\Exceptions\ApiException(Enums\ErrorCodes::NotPossibleToShareWithYourself);
				}
				if (!\Aurora\Modules\Core\Module::Decorator()->GetUserByPublicId($Share['PublicId'])) {
					throw new \Aurora\System\Exceptions\ApiException(Enums\ErrorCodes::UserNotExists);
				}
				if ($Share['Access'] === Enums\Access::Read) {
					$aGuests[] = $Share['PublicId'];
				} else if ($Share['Access'] === Enums\Access::Write) {
					$aOwners[] = $Share['PublicId'];
				} else if ($Share['Access'] === Enums\Access::Reshare) {
					$aReshare[] = $Share['PublicId'];
				}
				$aUpdateShares[] = $Share['PublicId'];
			}
			$aDuplicatedUsers = array_intersect($aOwners, $aGuests, $aReshare);
			if (!empty($aDuplicatedUsers)) {
				throw new \Aurora\System\Exceptions\ApiException(Enums\ErrorCodes::DuplicatedUsers);
			}

			$aGuestPublicIds = [];
			foreach ($Shares as $aShare) {
				$sPrincipalUri = 'principals/' . $aShare['PublicId'];
				if (in_array($sPrincipalUri, $aItemsToCreate)) {
					$Id = $this->getNonExistentFileName($sPrincipalUri, $Id);
					$mResult = $mResult && $this->oBackend->createSharedFile('principals/' . $sUserPublicId, $Storage, $FullPath, $Id, $sPrincipalUri, $aShare['Access'], $IsDir);
				} else if(in_array($sPrincipalUri, $aItemsToUpdate)) {
					$mResult = $mResult && $this->oBackend->updateSharedFile('principals/' . $sUserPublicId, $Storage, $FullPath, $sPrincipalUri, $aShare['Access']);
				}
				if ($mResult) {
					$sAccess = (int) $aShare['Access'] === Enums\Access::Read ? '(r)' : '(w)';
					$aGuestPublicIds[] = $aShare['PublicId'] . $sAccess;
				}
			}
			
			$sResourceId = $Storage . '/' . \ltrim(\ltrim($FullPath, '/'));
			$aArgs = [
				'UserId' => $UserId,
				'ResourceType' => 'file',
				'ResourceId' => $sResourceId,
				'Action' => 'update-share',
				'GuestPublicId' => \implode($aGuestPublicIds, ', ')
			];
			$this->broadcastEvent('AddToActivityHistory', $aArgs);
		}

		return $mResult;
	}

	/**
	 *
	 */
	public function onAfterGetFiles(&$aArgs, &$mResult)
	{
		if ($mResult)
		{
			$sPath = 'files/' . $aArgs['Type'] . $aArgs['Path'];
			try
			{
				$oNode = Server::getNodeForPath($sPath);
				if ($oNode instanceof \Afterlogic\DAV\FS\Shared\File || $oNode instanceof \Afterlogic\DAV\FS\Shared\Directory)
				{
					$mResult['Access'] = $oNode->getAccess();
				}
				if ($oNode instanceof \Afterlogic\DAV\FS\Shared\Directory)
				{
					$sResourceId = $oNode->getStorage() . '/' . \ltrim(\ltrim($oNode->getRelativeNodePath(), '/') . '/' . \ltrim($oNode->getName(), '/'), '/');
					$oUser = \Aurora\Modules\Core\Module::Decorator()->GetUserByPublicId($oNode->getOwnerPublicId());
					if ($oUser)
					{
						$aArgs = [
							'UserId' => $oUser->Id,
							'ResourceType' => 'file',
							'ResourceId' => $sResourceId,
							'Action' => 'list-share'
						];
						$this->broadcastEvent('AddToActivityHistory', $aArgs);
					}
				}
			}
			catch (\Exception $oEx) {}
		}
	}

	/**
	 * @ignore
	 * @param array $aArgs Arguments of event.
	 * @param mixed $mResult Is passed by reference.
	 */
	public function onAfterDeleteUser($aArgs, $mResult)
	{
		if ($mResult && $this->oBeforeDeleteUser instanceof \Aurora\Modules\Core\Models\User)
		{
			$this->oBackend->deleteSharesByPrincipal('principals/' . $this->oBeforeDeleteUser->PublicId);
		}
	}

	/**
	 * @ignore
	 * @param array $aArgs Arguments of event.
	 * @param mixed $mResult Is passed by reference.
	 */
	public function onAfterGetSubModules($aArgs, &$mResult)
	{
		array_unshift($mResult, self::$sStorageType);
	}
}
