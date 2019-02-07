<?php
/**
 * This code is licensed under AGPLv3 license or AfterLogic Software License
 * if commercial version of the product was purchased.
 * For full statements of the licenses see LICENSE-AFTERLOGIC and LICENSE-AGPL3 files.
 */

namespace Aurora\Modules\SharedFiles;

/**
 * @license https://www.gnu.org/licenses/agpl-3.0.html AGPL-3.0
 * @license https://afterlogic.com/products/common-licensing AfterLogic Software License
 * @copyright Copyright (c) 2018, Afterlogic Corp.
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
		];

		$this->subscribeEvent('Core::CreateTables::after', array($this, 'onAfterCreateTables'));

		$this->oBackend = \Afterlogic\DAV\Backend::getBackend('fs');
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
//			$oServer->setUser($aArgs['UserId']);
			$sPath = 'files/' . $aArgs['Type'] . $aArgs['Path'] . '/' .  $aArgs['Name'];

			$oNode = $oServer->tree->getNodeForPath($sPath);
			if ($oNode instanceof \Afterlogic\DAV\FS\File)
			{
				$mResult = $oNode->get();	
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

		$aShares = $this->oBackend->getShares('principals/' . $sUserPublicId, $Storage, $Path);
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

		$oUser = \Aurora\System\Api::getAuthenticatedUser();
		if ($oUser instanceof \Aurora\Modules\Core\Classes\User)
		{
			foreach ($Shares as $Share)
			{
				if ($oUser->PublicId === $Share['PublicId'])
				{
					throw new \Aurora\System\Exceptions\ApiException(Enums\ErrorCodes::NotPossibleToShareWithYourself);
				}
			}

			$sUserPublicId = \Aurora\System\Api::getUserPublicIdById($UserId);

			$Path =  !empty($Path) ? $Path . '/' . $Id : $Id;
			
			$mResult = $this->oBackend->deleteSharedFile('principals/' . $sUserPublicId, $Storage, $Path);
			foreach ($Shares as $aShare)
			{
				$Id = $this->getNonExistentFileName('principals/' . $aShare['PublicId'], $Id);
				$mResult &= $this->oBackend->createSharedFile('principals/' . $sUserPublicId, $Storage, $Path, $Id, 'principals/' . $aShare['PublicId'], $aShare['Access'], $IsDir);
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
}
