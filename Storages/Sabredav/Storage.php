<?php
/**
 * This code is licensed under AGPLv3 license or AfterLogic Software License
 * if commercial version of the product was purchased.
 * For full statements of the licenses see LICENSE-AFTERLOGIC and LICENSE-AGPL3 files.
 * 
 */

namespace Aurora\Modules\SharedFiles\Storages\Sabredav;

/**
 * @license https://www.gnu.org/licenses/agpl-3.0.html AGPL-3.0
 * @license https://afterlogic.com/products/common-licensing AfterLogic Software License
 * @copyright Copyright (c) 2018, Afterlogic Corp.
 *
 * @internal
 * 
 * @package Filestorage
 * @subpackage Storages
 */
class Storage extends \Aurora\Modules\PersonalFiles\Storages\Sabredav\Storage
{
	/**
	 * @param int $iUserId
	 * @param string $sType
	 * @param string $sPath
	 * @param string $sPattern
	 * @param string $sPublicHash
	 *
	 * @return array
	 */
	public function getFiles($iUserId, $sType = \Aurora\System\Enums\FileStorageType::Personal, $sPath = '', $sPattern = '', $sPublicHash = null)
	{
		$aResult = [];

		$sPath = 'files/' . $sType . $sPath;

		$oServer = \Afterlogic\DAV\Server::getInstance();
		$oServer->setUser($iUserId);

		$oNode = $oServer->tree->getNodeForPath($sPath);
		if ($oNode instanceof \Sabre\DAV\ICollection) 
		{
			var_dump($oNode->getPath()); exit;

			$depth = 1;
			if (!empty($sPattern))
			{
				$oServer->enablePropfindDepthInfinity = true;
				$depth = -1;
			}

			$oIterator = $oServer->getPropertiesIteratorForPath($sPath, [
				'{DAV:}displayname',
			], $depth);

			foreach ($oIterator as $iKey => $oItem)
			{
				// Skipping the parent path
				if ($iKey === 0) continue;

				if (empty($sPattern) || 
						(isset($oItem['200']['{DAV:}displayname']) && fnmatch($sPattern, $oItem['200']['{DAV:}displayname'])))
				{
					$sHref = $oItem['href'];
					$subNode = $oServer->tree->getNodeForPath($sHref);

					if ($subNode && !isset($aResult[$subNode->getPath()]))
					{
						list($sSubFullPath, ) = \Sabre\Uri\split(substr($sHref, 12));
		
						$oFileInfo = $this->getFileInfo($iUserId, $sType, $subNode, $sPublicHash, $sSubFullPath);
						$oFileInfo->Name = \basename($subNode->getPath());
		
						$aResult[$subNode->getPath()] = $oFileInfo;
					}
				}
			}
			$oServer->enablePropfindDepthInfinity = false;
			
			usort($aResult, 
				function ($a, $b) { 
					return ($a->Name > $b->Name); 
				}
			);			
		}
		
		return $aResult;
	}
}

