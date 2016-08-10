<?php

class SharedFilesModule extends AApiModule
{
	public function init() 
	{
		$this->subscribeEvent('Files::GetStorages::after', array($this, 'GetStorages'));
	}
	
	public function GetStorages(&$aResult)
	{
		$iUserId = \CApi::getAuthenticatedUserId();

		$aResult['@Result'][] = [
			'Type' => 'shared', 
			'IsExternal' => false,
			'DisplayName' => $this->i18N('LABEL_SHARED_STORAGE', $iUserId)
		];
	}

}