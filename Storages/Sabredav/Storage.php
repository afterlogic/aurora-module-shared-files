<?php
/**
 * This code is licensed under AGPLv3 license or Afterlogic Software License
 * if commercial version of the product was purchased.
 * For full statements of the licenses see LICENSE-AFTERLOGIC and LICENSE-AGPL3 files.
 * 
 */

namespace Aurora\Modules\SharedFiles\Storages\Sabredav;

use Afterlogic\DAV\FS\Shared\Root;
use Aurora\Api;
use Aurora\Modules\Core\Module;
use Aurora\System\Enums\FileStorageType;

use function Sabre\Uri\split;

/**
 * @license https://www.gnu.org/licenses/agpl-3.0.html AGPL-3.0
 * @license https://afterlogic.com/products/common-licensing Afterlogic Software License
 * @copyright Copyright (c) 2019, Afterlogic Corp.
 *
 * @internal
 * 
 * @package Filestorage
 * @subpackage Storages
 */
class Storage extends \Aurora\Modules\PersonalFiles\Storages\Sabredav\Storage
{

	/**
	 * @param string $sUserPublicId
	 * @param string $sType
	 * @param object $oItem
	 * @param string $sPublicHash
	 * @param string $sPath
	 *
	 * @return \Aurora\Modules\Files\Classes\FileItem|null
	 */
	public function getFileInfo($sUserPublicId, $sType, $oItem, $sPublicHash = null, $sPath = null)
	{
		$oResult = parent::getFileInfo($sUserPublicId, $sType, $oItem, $sPublicHash, $sPath);

		if (isset($oResult) && ($oItem instanceof \Afterlogic\DAV\FS\Shared\File ||$oItem instanceof \Afterlogic\DAV\FS\Shared\Directory))
		{
			$aExtendedProps = $oResult->ExtendedProps;
			$aExtendedProps['SharedWithMeAccess'] = (int) $oItem->getAccess();
			$oResult->ExtendedProps = $aExtendedProps;
		}

		return $oResult;
	}
}