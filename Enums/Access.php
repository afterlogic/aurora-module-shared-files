<?php

namespace Aurora\Modules\SharedFiles\Enums;

class Access extends \Aurora\System\Enums\AbstractEnumeration
{
	const Write	 = 1;
	const Read   = 2;
	const Reshare = 3;

	/**
	 * @var array
	 */
	protected $aConsts = array(
		'Write'	=> self::Write,
		'Read'	=> self::Read,
		'Reshare' => self::Reshare
	);
}