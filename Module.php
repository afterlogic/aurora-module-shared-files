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
	
	/**
	 *
	 * @var \CApiModuleDecorator
	 */
	protected $oMinModuleDecorator = null;

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
		if ($this->checkStorageType($aArgs['Type']))
		{
			$sUserPiblicId = \Aurora\System\Api::getUserPublicIdById($aArgs['UserId']);
			$sType = $aArgs['Type'];
			$sPath = $aArgs['Path'];
			$sHash = isset($aArgs['PublicHash']) ? $aArgs['PublicHash'] : null;

			$mResult = $this->getManager()->getFiles($sUserPiblicId, $sType, $sPath, $aArgs['Pattern'], $sHash);
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

	
	public function GetShares($UserId, $Path)
	{
		$aResult = [];

		$oFsBackend = \Afterlogic\DAV\Backend::getBackend('fs');
		$sUserPublicId = \Aurora\System\Api::getUserPublicIdById($UserId);

		$aShares = $oFsBackend->getSharesForFile($sUserPublicId, $Path);
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
		$oFsBackend = \Afterlogic\DAV\Backend::getBackend('fs');
		$sUserPublicId = \Aurora\System\Api::getUserPublicIdById($UserId);

		$oFsBackend->deleteSharedFile($sUserPublicId, $Storage, $Path, $Id);
		foreach ($Shares as $aShare)
		{
			$Path =  !empty($Path) ? $Path . '/' . $Id : $Id;
			$aPathInfo = pathinfo($Path);

			$Id = \md5($sUserPublicId . $Storage . $Path) . (isset($aPathInfo['extension']) ? '.' . $aPathInfo['extension'] : '');

			$oFsBackend->createSharedFile('principals/' . $sUserPublicId, $Storage, $Path, $Id, 'principals/' . $aShare['PublicId'], $aShare['Access'], $IsDir);
		}
	}
}
