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
	protected static $sStorageType = 'shared';

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
		$this->subscribeEvent('Core::CreateTables::after', array($this, 'onAfterCreateTables'));
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

		$oFsBackend = \Afterlogic\DAV\Backend::getBackend('fs');
		$sUserPublicId = \Aurora\System\Api::getUserPublicIdById($UserId);

		$aShares = $oFsBackend->getShares('principals/' . $sUserPublicId, $Storage, $Path);
		foreach ($aShares as $aShare)
		{
			$aResult[] = [
				'PublicId' => basename($aShare['principaluri']),
				'Access' => $aShare['access']
			];
		}

		return $aResult;
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

			$oFsBackend = \Afterlogic\DAV\Backend::getBackend('fs');
			$sUserPublicId = \Aurora\System\Api::getUserPublicIdById($UserId);

			$Path =  !empty($Path) ? $Path . '/' . $Id : $Id;
			$aPathInfo = pathinfo($Path);

			$Id = \md5($sUserPublicId . $Storage . $Path) . (isset($aPathInfo['extension']) ? '.' . $aPathInfo['extension'] : '');
			$oFsBackend->deleteSharedFile('principals/' . $sUserPublicId, $Storage, $Path);
			foreach ($Shares as $aShare)
			{
				$mResult = $oFsBackend->createSharedFile('principals/' . $sUserPublicId, $Storage, $Path, $Id, 'principals/' . $aShare['PublicId'], $aShare['Access'], $IsDir);
			}
		}

		return $mResult;
	}

	public function onAfterCreateTables(&$aData, &$mResult)
	{
		$this->getManager()->createTablesFromFile();
	}
}
