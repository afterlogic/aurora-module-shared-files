<?php

namespace Aurora\Modules\SharedFiles\Enums;

class Access extends \Aurora\System\Enums\AbstractEnumeration
{
	const NoAccess = 0;
	const Write	 = 1;
	const Read   = 2;
	const Reshare = 3;

	/**
	 * @var array
	 */
	protected $aConsts = array(
		'NoAccess'	=> self::NoAccess,
		'Write'	=> self::Write,
		'Read'	=> self::Read,
		'Reshare' => self::Reshare
	);
}