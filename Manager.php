<?php
/**
 * This code is licensed under AGPLv3 license or AfterLogic Software License
 * if commercial version of the product was purchased.
 * For full statements of the licenses see LICENSE-AFTERLOGIC and LICENSE-AGPL3 files.
 */

namespace Aurora\Modules\SharedFiles;

/**
 * CApiFilestorageManager class summary
 *
 * @license https://www.gnu.org/licenses/agpl-3.0.html AGPL-3.0
 * @license https://afterlogic.com/products/common-licensing AfterLogic Software License
 * @copyright Copyright (c) 2018, Afterlogic Corp.
 * 
 * @package Filestorage
 */
class Manager extends \Aurora\Modules\PersonalFiles\Manager
{
	/**
	 * @param \Aurora\System\Module\AbstractModule $oModule
	 */
	public function __construct(\Aurora\System\Module\AbstractModule $oModule = null)
	{
		parent::__construct($oModule);

		$this->oStorage = new Storages\Sabredav\Storage($this);
	}

	/**
	 * Creates tables required for module work by executing create.sql file.
	 *
	 * @return boolean
	 */
	public function createTablesFromFile()
	{
		$sFilePath = dirname(__FILE__) . '/Sql/create.sql';
		$bResult = \Aurora\System\Managers\Db::getInstance()->executeSqlFile($sFilePath);

		return $bResult;
	}
}
