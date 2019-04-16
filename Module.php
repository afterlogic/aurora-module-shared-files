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
	 */
	protected $oBackend;

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

		$this->aErrors = [
			Enums\ErrorCodes::NotPossibleToShareWithYourself	=> $this->i18N('ERROR_NOT_POSSIBLE_TO_SHARE_WITH_YOURSELF'),
			Enums\ErrorCodes::UnknownError				=> $this->i18N('ERROR_UNKNOWN_ERROR'),
			Enums\ErrorCodes::UserNotExists				=> $this->i18N('ERROR_USER_NOT_EXISTS'),
			Enums\ErrorCodes::DuplicatedUsers			=> $this->i18N('ERROR_DUPLICATE_USERS_BACKEND')
		];

		$this->subscribeEvent('Core::CreateTables::after', array($this, 'onAfterCreateTables'));
		$this->subscribeEvent('Files::GetFiles::after', array($this, 'onAfterGetFiles'));

		$this->oBackend = new \Afterlogic\DAV\FS\Backend\PDO();
	}

	/**
	 * @ignore
	 * @param array $aArgs Arguments of event.
	 * @param mixed $mResult Is passed by reference.
	 */
	public function onAfterGetStorages($aArgs, &$mResult)
	{
		$mResult[] = [
			'Type' => static::$sStorageType, 
			'DisplayName' => $this->i18N('LABEL_STORAGE'), 
			'IsExternal' => false
		];
	}	

	/**
	 * @ignore
	 * @param array $aArgs Arguments of event.
	 * @param mixed $mResult Is passed by reference.
	 */
	public function onAfterGetItems($aArgs, &$mResult)
	{
		parent::onAfterGetItems($aArgs, $mResult);

		if (is_array($mResult))
		{
			foreach ($mResult as $oItem)
			{
				$oExtendedProps = $oItem->ExtendedProps;
				$oExtendedProps['Shares'] = $this->GetShares($aArgs['UserId'], $aArgs['Type'], $oItem->Path . $oItem->Id);
				$oItem->ExtendedProps = $oExtendedProps;
			}
		}
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
				if ($aArgs['IsThumb'])
				{
					$mResult = $oNode->get();	
				}
				else
				{
					$mResult = $oNode->get(true);	
				}
			}
			else
			{
				$mResult = false;
				header("HTTP/1.0 404 Not Found");
				die('File not found');
			}
			
			return true;
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
		if ($oUser instanceof \Aurora\Modules\Core\Classes\User)
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
				if ($Share['Access'] === 2)//read TODO: replace with constant
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
			foreach ($Shares as $aShare)
			{
				$Id = $this->getNonExistentFileName('principals/' . $aShare['PublicId'], $Id);
				$mResult = $mResult && $this->oBackend->createSharedFile('principals/' . $sUserPublicId, $Storage, $Path, $Id, 'principals/' . $aShare['PublicId'], $aShare['Access'], $IsDir);
			}
		}

		return $mResult;
	}

	/**
	 * 
	 */
	public function onAfterCreateTables(&$aData, &$mResult)
	{
		$this->getManager()->createTablesFromFile();
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
			}
			catch (\Exception $oEx) {}
		}
	}

	/**
	 * @ignore
	 * @param array $aArgs Arguments of event.
	 * @param mixed $mResult Is passed by reference.
	 */
	public function onBeforeDeleteUser($aArgs, &$mResult)
	{
		if (isset($aArgs['UserId']))
		{
			$oUser = \Aurora\System\Api::getUserById($aArgs['UserId']);
			if ($oUser)
			{
				$this->oBackend->deleteSharesByPrincipal('principals/' . $oUser->PublicId);
			}
		}
	}

	/**
	 * @ignore
	 * @param array $aArgs Arguments of event.
	 * @param mixed $mResult Is passed by reference.
	 */
	public function onAfterGetSubModules($aArgs, &$mResult)
	{
		array_unshift($mResult, static::$sStorageType);
	}	
}
