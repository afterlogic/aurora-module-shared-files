<?php
/**
 * This code is licensed under AGPLv3 license or Afterlogic Software License
 * if commercial version of the product was purchased.
 * For full statements of the licenses see LICENSE-AFTERLOGIC and LICENSE-AGPL3 files.
 */

namespace Aurora\Modules\SharedFiles;

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
		if ($this->checkStorageType($aArgs['Type']))
		{
			parent::onAfterGetItems($aArgs, $mResult);
		}

		if (is_array($mResult))
		{
			foreach ($mResult as $oItem)
			{
				$oExtendedProps = $oItem->ExtendedProps;
				$oExtendedProps['Shares'] = $this->GetShares($aArgs['UserId'], $aArgs['Type'], \rtrim($oItem->Path, '/') . '/' . $oItem->Id);
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

	/**
	 * Puts file content to $mResult.
	 * @ignore
	 * @param array $aArgs Arguments of event.
	 * @param mixed $mResult Is passed by reference.
	 */
	public function onGetFile($aArgs, &$mResult)
	{
		if ($this->checkStorageType($aArgs['Type']))
		{
			$oServer = \Afterlogic\DAV\Server::getInstance();

			// $oServer->setUser(
			// 	\Aurora\Api::getUserPublicIdById($aArgs['UserId'])
			// );
			$sPath = 'files/' . $aArgs['Type'] . $aArgs['Path'] . '/' .  $aArgs['Name'];

			$oNode = $oServer->tree->getNodeForPath($sPath);
			if ($oNode instanceof \Afterlogic\DAV\FS\File)
			{
				$sExt = \pathinfo($aArgs['Name'], PATHINFO_EXTENSION);
				$bNoRedirect = (isset($aArgs['NoRedirect']) && $aArgs['NoRedirect']) ? true : false;

				if ($aArgs['IsThumb'] || $this->isNeedToReturnBody() || \strtolower($sExt) === 'url' || $bNoRedirect)
				{
					$mResult = $oNode->get(false);
				}
				else
				{
					$mResult = $oNode->get(true);
					$sRelativePath = $oNode instanceof \Afterlogic\DAV\FS\Shared\File ? $oNode->getRelativeNodePath() : $oNode->getRelativePath();
					$sResourceId = $oNode->getStorage() . '/' . \ltrim(\ltrim($sRelativePath, '/') . '/' . \ltrim($oNode->getName(), '/'), '/');

					$sOwnerPublicId = $oNode instanceof \Afterlogic\DAV\FS\Shared\File ? $oNode->getOwnerPublicId() : $oNode->getUser();
					$oUser = \Aurora\Modules\Core\Module::Decorator()->GetUserByPublicId($sOwnerPublicId);
					if ($oUser)
					{
						$aArgs = [
							'UserId' => $oUser->Id,
							'ResourceType' => 'file',
							'ResourceId' => $sResourceId,
							'Action' => 'get-share'
						];
						$this->broadcastEvent('AddToActivityHistory', $aArgs);
					}
				}
			}
			else
			{
				$mResult = false;
//				echo(\Aurora\System\Managers\Response::GetJsonFromObject('Json', \Aurora\System\Managers\Response::FalseResponse(__METHOD__, 404, 'Not Found')));
				$this->oHttp->StatusHeader(404);
				exit;
			}

			return true;
		}
	}

	public function onAfterDelete(&$aArgs, &$mResult)
	{
		$iUserId = $aArgs['UserId'];
		$sStorage = $aArgs['Type'];
		$aItems = $aArgs['Items'];

		$sUserPublicId = \Aurora\System\Api::getUserPublicIdById($iUserId);
		foreach ($aItems as $aItem)
		{
			$this->oBackend->deleteSharedFile('principals/' . $sUserPublicId, $sStorage, $aItem['Path'] . '/' . $aItem['Name']);
		}
	}

	public function GetShares($UserId, $Storage, $Path)
	{
		$aResult = [];

		$sUserPublicId = \Aurora\System\Api::getUserPublicIdById($UserId);

		$aShares = $this->oBackend->getShares('principals/' . $sUserPublicId, $Storage, '/' . \ltrim($Path, '/'));
		foreach ($aShares as $aShare)
		{
			$aResult[] = [
				'PublicId' => basename($aShare['principaluri']),
				'Access' => $aShare['access']
				// 'Access' => \Aurora\Modules\SharedFiles\Enums\Access::Read
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
	public function getNonExistentFileName($principalUri, $sFileName)
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

		while ($this->oBackend->getSharedFileByUid($principalUri, $sFileName))
		{
			$sFileName = $sNameWOExt.' ('.$iIndex.')'.$sExt;
			$iIndex++;
		}

		return $sFileName;
	}

	public function UpdateShare($UserId, $Storage, $Path, $Id, $Shares, $IsDir = false)
	{
		$mResult = false;
		$aGuests = [];
		$aOwners = [];

		$oUser = \Aurora\System\Api::getAuthenticatedUser();
		if ($oUser instanceof \Aurora\Modules\Core\Models\User)
		{
			foreach ($Shares as $Share)
			{
				if ($oUser->PublicId === $Share['PublicId'])
				{
					throw new \Aurora\System\Exceptions\ApiException(Enums\ErrorCodes::NotPossibleToShareWithYourself);
				}
				if (!\Aurora\Modules\Core\Module::Decorator()->GetUserByPublicId($Share['PublicId']))
				{
					throw new \Aurora\System\Exceptions\ApiException(Enums\ErrorCodes::UserNotExists);
				}
				if ($Share['Access'] === Enums\Access::Read)
				{
					$aGuests[] = $Share['PublicId'];
				}
				else//write TODO: replace with constant
				{
					$aOwners[] = $Share['PublicId'];
				}
			}
			$aDuplicatedUsers = array_intersect($aOwners, $aGuests);
			if (!empty($aDuplicatedUsers))
			{
				throw new \Aurora\System\Exceptions\ApiException(Enums\ErrorCodes::DuplicatedUsers);
			}

			$sUserPublicId = \Aurora\System\Api::getUserPublicIdById($UserId);

			$Path =  $Path . '/' . $Id;

			$mResult = $this->oBackend->deleteSharedFile('principals/' . $sUserPublicId, $Storage, $Path);
			$aGuestPublicIds = [];
			foreach ($Shares as $aShare)
			{
				$Id = $this->getNonExistentFileName('principals/' . $aShare['PublicId'], $Id);
				$mResult = $mResult && $this->oBackend->createSharedFile('principals/' . $sUserPublicId, $Storage, $Path, $Id, 'principals/' . $aShare['PublicId'], $aShare['Access'], $IsDir);
				if ($mResult)
				{
					$sAccess = (int) $aShare['Access'] === Enums\Access::Read ? '(r)' : '(w)';
					$aGuestPublicIds[] = $aShare['PublicId'] . $sAccess;
				}
			}
			$sResourceId = $Storage . '/' . \ltrim(\ltrim($Path, '/'));
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
			$oServer = \Afterlogic\DAV\Server::getInstance();
			$sPath = 'files/' . $aArgs['Type'] . $aArgs['Path'];
			try
			{
				$oNode = $oServer->tree->getNodeForPath($sPath);
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
