<?php
/**
 * This code is licensed under AGPLv3 license or Afterlogic Software License
 * if commercial version of the product was purchased.
 * For full statements of the licenses see LICENSE-AFTERLOGIC and LICENSE-AGPL3 files.
 */

namespace Aurora\Modules\SharedFiles;

use Afterlogic\DAV\Constants;
use Afterlogic\DAV\FS\Permission;
use Afterlogic\DAV\Server;
use Aurora\Api;
use Aurora\Modules\Core\Module as CoreModule;
use Aurora\Modules\Files\Module as FilesModule;
use Aurora\Modules\SharedFiles\Enums\ErrorCodes;
use Aurora\System\Enums\FileStorageType;
use Aurora\System\Enums\UserRole;
use Aurora\System\Exceptions\ApiException;
use Afterlogic\DAV\FS\Shared\File as SharedFile;
use Afterlogic\DAV\FS\Shared\Directory as SharedDirectory;
use Aurora\Modules\Core\Models\User;
use Aurora\Modules\SharedFiles\Enums\Access;
use Aurora\System\Router;

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
	 * @var bool
	 */
	protected static $bIsDroppable = false;

	/**
	 *
	 * @var \Afterlogic\DAV\FS\Backend\PDO
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
			Enums\ErrorCodes::DuplicatedUsers			=> $this->i18N('ERROR_DUPLICATE_USERS_BACKEND'),
			Enums\ErrorCodes::NotPossibleToShareDirectoryInEcryptedStorage => $this->i18N('CANNOT_SHARE_DIRECTORY_IN_ECRYPTED_STORAGE'),
			Enums\ErrorCodes::IncorrectFilename => $this->i18N('INCORRECT_FILE_NAME'),
		];

		$this->subscribeEvent('Files::GetFiles::after', [$this, 'onAfterGetFiles']);
		$this->subscribeEvent('Files::GetItems::after', [$this, 'onAfterGetItems'], 10000);

		$this->subscribeEvent('Core::AddUsersToGroup::after', [$this, 'onAfterAddUsersToGroup']);
		$this->subscribeEvent('Core::RemoveUsersFromGroup::after', [$this, 'onAfterRemoveUsersFromGroup']);
		$this->subscribeEvent('Core::UpdateUser::after', [$this, 'onAfterUpdateUser']);
		$this->subscribeEvent('Core::DeleteGroup::after', [$this, 'onAfterDeleteGroup']);
		$this->subscribeEvent('Files::PopulateExtendedProps', [$this, 'onPopulateExtendedProps'], 10000);
		$this->subscribeEvent('Files::LeaveShare', [$this, 'onLeaveShare']);
	}

	protected function populateExtendedProps($userId, $type, $path, &$aExtendedProps)
	{
		$bSharedWithMe = isset($aExtendedProps['SharedWithMeAccess']) ? $aExtendedProps['SharedWithMeAccess'] === Permission::Reshare : false;
		$aExtendedProps['Shares'] = $this->GetShares(
			$userId, 
			$type, 
			$path, 
			$bSharedWithMe
		);
	}

	/**
	 * @ignore
	 * @param array $aArgs Arguments of event.
	 * @param mixed $mResult Is passed by reference.
	 */
	public function onAfterGetItems($aArgs, &$mResult)
	{
		if (is_array($mResult)) {
			foreach ($mResult as $oItem) {
				$aExtendedProps = $oItem->ExtendedProps;
				$this->populateExtendedProps($aArgs['UserId'], $aArgs['Type'], \rtrim($oItem->Path, '/') . '/' . $oItem->Id, $aExtendedProps);
				$oItem->ExtendedProps = $aExtendedProps;
			}
		}
	}

	protected function isNeedToReturnBody()
	{
		$sMethod = $this->oHttp->GetPost('Method', null);

        return ((string) Router::getItemByIndex(2, '') === 'thumb' ||
			$sMethod === 'SaveFilesAsTempFiles' ||
			$sMethod === 'GetFilesForUpload'
		);
	}

	protected function isNeedToReturnWithContectDisposition()
	{
		$sAction = (string) Router::getItemByIndex(2, 'download');
        return $sAction ===  'download';
	}

	public function GetShares($UserId, $Storage, $Path, $SharedWithMe = false)
	{
		$aResult = [];

		Api::checkUserRoleIsAtLeast(UserRole::NormalUser);

		Api::CheckAccess($UserId);

		$sUserPublicId = Api::getUserPublicIdById($UserId);
		$oUser = Api::getUserById($UserId);
		$sFullPath = 'files/' . $Storage . '/' . \ltrim($Path, '/');
		$oNode = Server::getNodeForPath($sFullPath);
		if ($oNode) {
			if ($oNode->getAccess() === Enums\Access::Reshare) {
				Server::checkPrivileges('files/' . $Storage . '/' . \ltrim($Path, '/'), '{DAV:}write-acl');
				$aShares = $this->oBackend->getShares(Constants::PRINCIPALS_PREFIX . $oNode->getOwnerPublicId(), $oNode->getStorage(), '/' . \ltrim($Path, '/'));
			} else {
				$aShares = $this->oBackend->getShares(Constants::PRINCIPALS_PREFIX . $sUserPublicId, $Storage, '/' . \ltrim($Path, '/'));
			}

			if (!$aShares && $SharedWithMe && !$oNode->isInherited()) {

				$aSharedFile = $this->oBackend->getSharedFileByUidWithPath(
					Constants::PRINCIPALS_PREFIX . $sUserPublicId, 
					$oNode->getName(), 
					$oNode->getSharePath()
				);
				if ($aSharedFile) {
					$aShares = $this->oBackend->getShares(
						$aSharedFile['owner'], 
						$aSharedFile['storage'], 
						$aSharedFile['path']
					);
				}
			}
			$aGroups = [];
			foreach ($aShares as $aShare) {
				if ($aShare['group_id'] != 0) {

					if (!in_array($aShare['group_id'], $aGroups)) {
						$oGroup = CoreModule::Decorator()->GetGroup($oUser->IdTenant, (int) $aShare['group_id']);
						if ($oGroup) {
							$aGroups[] = $aShare['group_id'];
							$aResult[] = [
								'PublicId' => $oGroup->getName(),
								'Access' => $aShare['access'],
								'IsGroup' => true,
								'IsAll' => !!$oGroup->IsAll,
								'GroupId' => (int) $aShare['group_id']
							];
						}
					}
				} else {
					$aResult[] = [
						'PublicId' => basename($aShare['principaluri']),
						'Access' => $aShare['access']
					];
				}
			}
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
	protected function getNonExistentFileName($principalUri, $sFileName, $sPath = '', $bWithoutGroup = false)
	{
		$iIndex = 1;
		$sFileNamePathInfo = pathinfo($sFileName);
		$sExt = isset($sFileNamePathInfo['extension']) ? '.'.$sFileNamePathInfo['extension'] : '';
		$sNameWOExt = isset($sFileNamePathInfo['filename']) ? $sFileNamePathInfo['filename'] : $sFileName;

		while ($this->oBackend->getSharedFileByUidWithPath($principalUri, $sFileName, $sPath, $bWithoutGroup))
		{
			$sFileName = $sNameWOExt.' ('.$iIndex.')'.$sExt;
			$iIndex++;
		}
		list(, $sUserPublicId) = \Sabre\Uri\split($principalUri);
		$oUser = CoreModule::getInstance()->GetUserByPublicId($sUserPublicId);

		if ($oUser) {
			$sPrevState = Api::skipCheckUserRole(true);
			$sFileName = FilesModule::Decorator()->GetNonExistentFileName(
				$oUser->Id,
				FileStorageType::Personal,
				$sPath,
				$sFileName,
				$bWithoutGroup
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

		Api::checkUserRoleIsAtLeast(UserRole::NormalUser);
		Api::CheckAccess($UserId);

		$oUser = Api::getAuthenticatedUser();
		if ($oUser instanceof User) {
			$sUserPublicId = Api::getUserPublicIdById($UserId);
			$sInitiator = $sUserPrincipalUri = Constants::PRINCIPALS_PREFIX . $sUserPublicId;
			$FullPath =  $Path . '/' . $Id;
			Server::checkPrivileges('files/' . $Storage . '/' . \ltrim($FullPath, '/'), '{DAV:}write-acl');
			$oNode = Server::getNodeForPath('files/' . $Storage . '/' . \ltrim($FullPath, '/'));
			$bIsEncrypted = false;
			if ($oNode) {         
				$aExtendedProps = $oNode->getProperty('ExtendedProps');
				$bIsEncrypted = (is_array($aExtendedProps) && isset($aExtendedProps['InitializationVector']));

				$aSharePublicIds = array_map(function ($share) {
					return strtolower($share['PublicId']);
				}, $Shares);
				if (in_array(strtolower($oNode->getOwner()), $aSharePublicIds)) {
					throw new ApiException(Enums\ErrorCodes::NotPossibleToShareWithYourself);
				}
			}
			$bIsShared = ($oNode instanceof SharedFile || $oNode instanceof SharedDirectory);
			if ($bIsShared) {
				$aSharedFile = $this->oBackend->getSharedFileByUidWithPath(
					$sUserPrincipalUri, 
					$oNode->getName(), 
					$oNode->getSharePath()
				);
				if ($aSharedFile) {
					$sUserPrincipalUri = $aSharedFile['owner'];
				} else {
					$sUserPrincipalUri = 'principals/' . $oNode->getOwner();
				}
				$ParentNode = $oNode->getNode();
				$FullPath = $ParentNode->getRelativePath() . '/' . $ParentNode->getName();
				$Storage = $oNode->getStorage();
			}

			$aResultShares = [];
			foreach ($Shares as $item) {
				if (isset($item['GroupId'])) {
					$aUsers = CoreModule::Decorator()->GetGroupUsers($oUser->IdTenant, (int) $item['GroupId']);
					foreach ($aUsers as $aUser) {
						$aResultShares[] = [
							'PublicId' => $aUser['PublicId'],
							'Access' => (int) $item['Access'],
							'GroupId' => (int) $item['GroupId'],
						];
					}
				} else {
					$item['GroupId'] = 0;
					$aResultShares[] = $item;
				}
			}

			$aDbShares = $this->oBackend->getShares(
				$sUserPrincipalUri, 
				$Storage, '/' . \ltrim($FullPath, '/')
			);

			$aOldSharePrincipals = array_map(function ($aShareItem) {
				if (isset($aShareItem['principaluri'])) {
					return \json_encode([
						$aShareItem['principaluri'], 
						$aShareItem['group_id']
					]);
				}
			}, $aDbShares);
			
			$aNewSharePrincipals = array_map(function ($aShareItem) {
				if (isset($aShareItem['PublicId'])) {
					return \json_encode([
						Constants::PRINCIPALS_PREFIX . $aShareItem['PublicId'],
						$aShareItem['GroupId']
					]);
				}
			}, $aResultShares);

			$aItemsToDelete = array_diff($aOldSharePrincipals, $aNewSharePrincipals);
			$aItemsToCreate = array_diff($aNewSharePrincipals, $aOldSharePrincipals);
			$aItemsToUpdate = array_intersect($aOldSharePrincipals, $aNewSharePrincipals);

			foreach ($aItemsToDelete as $aItem) {
				$aItem = \json_decode($aItem);
				$mResult = $this->oBackend->deleteSharedFileByPrincipalUri(
					$aItem[0], 
					$Storage, 
					$FullPath,
					$aItem[1]
				);
			}

			foreach ($aResultShares as $Share) {
				if (!$bIsShared && $oUser->PublicId === $Share['PublicId'] && $Share['GroupId'] == 0) {
					throw new ApiException(Enums\ErrorCodes::NotPossibleToShareWithYourself);
				}
				if (!CoreModule::Decorator()->GetUserByPublicId($Share['PublicId'])) {
					throw new ApiException(Enums\ErrorCodes::UserNotExists);
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
//				throw new ApiException(Enums\ErrorCodes::DuplicatedUsers);
			}

			$aGuestPublicIds = [];
			foreach ($aResultShares as $aShare) {
				$sPrincipalUri = Constants::PRINCIPALS_PREFIX . $aShare['PublicId'];

				$groupId = (int) $aShare['GroupId'];
				
				try {
					$bCreate = false;
					foreach($aItemsToCreate as $aItemToCreate) {
						$aItemToCreate = \json_decode($aItemToCreate);
						if ($sPrincipalUri === $aItemToCreate[0] && $groupId == $aItemToCreate[1]) {
							$bCreate = true;
							break;
						}
					}
					if ($bCreate) {
						if ($groupId == 0) {
							$sNonExistentFileName = $this->getNonExistentFileName($sPrincipalUri, $Id, '', true);
						} else {
							$sNonExistentFileName = $Id;
						}
						$mCreateResult = $this->oBackend->createSharedFile(
							$sUserPrincipalUri, 
							$Storage, 
							$FullPath, 
							$sNonExistentFileName, 
							$sPrincipalUri, 
							$aShare['Access'], 
							$IsDir,
							'',
							$groupId,
							$sInitiator
						);
						if ($mCreateResult) {
							$aArgs = [
								'UserPrincipalUri' => $sUserPrincipalUri,
								'Storage' => $Storage,
								'FullPath' => $FullPath,
								'Share' => $aShare,
							];
							$this->broadcastEvent($this->GetName() . '::CreateSharedFile', $aArgs);
						}
						$mResult = $mResult && $mCreateResult;
					} else {
						$bUpdate = false;
						foreach($aItemsToUpdate as $aItemToUpdate) {
							$aItemToUpdate = \json_decode($aItemToUpdate);
							if ($sPrincipalUri === $aItemToUpdate[0] && $groupId == $aItemToUpdate[1]) {
								$bUpdate = true;
								break;
							}
						}
						if ($bUpdate) {
							$mUpdateResult = $this->oBackend->updateSharedFile(
								$sUserPrincipalUri, 
								$Storage, 
								$FullPath, 
								$sPrincipalUri, 
								$aShare['Access'],
								$groupId
							);
							if ($mUpdateResult) {
								$aArgs = [
									'UserPrincipalUri' => $sUserPrincipalUri,
									'Storage' => $Storage,
									'FullPath' => $FullPath,
									'Share' => $aShare,
								];
								$this->broadcastEvent($this->GetName() . '::UpdateSharedFile', $aArgs);
							}
							$mResult = $mResult && $mUpdateResult;
						}
					}
				} catch (\PDOException $oEx) {
					if (isset($oEx->errorInfo[1]) && $oEx->errorInfo[1] === 1366) {
						throw new ApiException(ErrorCodes::IncorrectFilename, $oEx);
					} else {
						throw $oEx;
					}
				}

				if ($mResult) {
					switch ((int) $aShare['Access']) {
						case Enums\Access::Read:
							$sAccess = '(r)';
							break;
						case Enums\Access::Write:
							$sAccess = '(r/w)';
							break;
						case Enums\Access::Reshare:
							$sAccess = '(r/w/s)';
							break;
						default:
							$sAccess = '(r/w)';
							break;
					}
					$aGuestPublicIds[] = $aShare['PublicId'] . ' - ' . $sAccess;
				}
			}
			
			$sResourceId = $Storage . '/' . \ltrim(\ltrim($FullPath, '/'));
			$aArgs = [
				'UserId' => $UserId,
				'ResourceType' => 'file',
				'ResourceId' => $sResourceId,
				'Action' => 'update-share',
				'GuestPublicId' => \implode(', ', $aGuestPublicIds)
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
		if ($mResult) {
			try {
				$oNode = Server::getNodeForPath('files/' . $aArgs['Type'] . $aArgs['Path']);
				if ($oNode instanceof SharedFile || $oNode instanceof SharedDirectory) {
					$mResult['Access'] = $oNode->getAccess();
				}
				if ($oNode instanceof SharedDirectory) {
					$sResourceId = $oNode->getStorage() . '/' . \ltrim(\ltrim($oNode->getRelativeNodePath(), '/') . '/' . \ltrim($oNode->getName(), '/'), '/');
					$oUser = CoreModule::Decorator()->GetUserByPublicId($oNode->getOwnerPublicId());
					if ($oUser) {
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
		if ($mResult && $this->oBeforeDeleteUser instanceof User) {
			$this->oBackend->deleteSharesByPrincipal(Constants::PRINCIPALS_PREFIX . $this->oBeforeDeleteUser->PublicId);
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

	public function onAfterAddUsersToGroup($aArgs, &$mResult)
	{
		if ($mResult) {
			foreach ($aArgs['UserIds'] as $iUserId) {
				$userPublicId = Api::getUserPublicIdById($iUserId);
				$sUserPrincipalUri = 'principals/' . $userPublicId;
				$aDbShares = $this->oBackend->getSharesByPrincipalUriAndGroupId($sUserPrincipalUri, $aArgs['GroupId']);

				foreach ($aDbShares as $aDbShare) {

					$mResult = $mResult && $this->oBackend->createSharedFile(
						$aDbShare['owner'], 
						$aDbShare['storage'], 
						$aDbShare['path'], 
						basename($aDbShare['path']), 
						$sUserPrincipalUri, 
						$aDbShare['access'], 
						$aDbShare['isdir'],
						'',
						$aDbShare['group_id'],
						$aDbShares['initiator']
					);				
				}
			}
		}
	}

	public function onAfterUpdateUser($aArgs, &$mResult)
	{
		if ($mResult) {

			$groupIds = $aArgs['GroupIds'];
			$userId = $aArgs['UserId'];

			$userPublicId = Api::getUserPublicIdById($userId);
			$sUserPrincipalUri = 'principals/' . $userPublicId;

			if (count($groupIds) > 0) {
				
				$aDbCreateShares = [];
				foreach ($groupIds as $groupId) {
					$aDbCreateShares = array_merge(
						$aDbCreateShares,
						$this->oBackend->getSharesByPrincipalUriAndGroupId($sUserPrincipalUri, $groupId)
					);
				}

				foreach ($aDbCreateShares as $aShare) {
				
					$mResult && $this->oBackend->createSharedFile(
						$aShare['owner'], 
						$aShare['storage'], 
						$aShare['path'], 
						basename($aShare['path']), 
						$sUserPrincipalUri, 
						$aShare['access'], 
						$aShare['isdir'],
						'',
						$aShare['group_id'],
						$aShare['initiator']
					);
				}
			} else {
				$groupIds[] = 0;
			}
			$this->oBackend->deleteShareNotInGroups($sUserPrincipalUri, $groupIds);
		}
	}

	public function onAfterRemoveUsersFromGroup($aArgs, &$mResult)
	{
		if ($mResult) {
			foreach ($aArgs['UserIds'] as $iUserId) {
				$oUser = Api::getUserById($iUserId);
				$this->oBackend->deleteShareByPrincipaluriAndGroupId('principals/' . $oUser->PublicId, $aArgs['GroupId']);
			}
		}		
	}

	public function onAfterDeleteGroup($aArgs, &$mResult)
	{
		if ($mResult) {
			$this->oBackend->deleteSharesByGroupId($aArgs['GroupId']);
		}
	}

	public function onPopulateExtendedProps(&$aArgs, &$mResult)
	{
		$oItem = $aArgs['Item'];
		if ($oItem instanceof SharedFile || $oItem instanceof SharedDirectory) {
			$mResult['SharedWithMeAccess'] = $oItem->getAccess();
		}

		$this->populateExtendedProps(
			$aArgs['UserId'], 
			$aArgs['Type'], 
			\rtrim($aArgs['Path'], '/') . '/' . $aArgs['Name'], 
			$mResult
		);
	}

	public function onLeaveShare(&$aArgs, &$mResult)
	{
		$UserId = $aArgs['UserId'];
		Api::checkUserRoleIsAtLeast(UserRole::NormalUser);
		Api::CheckAccess($UserId);

		$oUser = Api::getAuthenticatedUser();
		if ($oUser instanceof User) {
			$sUserPublicId = Api::getUserPublicIdById($UserId);
			$sUserPrincipalUri = Constants::PRINCIPALS_PREFIX . $sUserPublicId;

			foreach ($aArgs['Items'] as $aItem) {

				if ($aItem->getGroupId() > 0) {
					$this->oBackend->createSharedFile(
						'principals/' . $aItem->getOwnerPublicId(), 
						$aItem->getStorage(), 
						$aItem->getNode()->getRelativePath() . '/' . $aItem->getName(), 
						$aItem->getName(), 
						$sUserPrincipalUri, 
						Access::NoAccess, 
						($aItem instanceof SharedDirectory),
						'',
						0,
						'principals/' . $aItem->getOwnerPublicId()
					);
				} else {
					$this->oBackend->updateSharedFile(
						'principals/' . $aItem->getOwnerPublicId(), 
						$aItem->getStorage(), 
						$aItem->getNode()->getRelativePath() . '/' . $aItem->getName(), 
						$sUserPrincipalUri, 
						Access::NoAccess, 
						0,
						'principals/' . $aItem->getOwnerPublicId()
					);					
				}
			}

			$mResult = true;
		}
	}
}
