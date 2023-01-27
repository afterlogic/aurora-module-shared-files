<?php

namespace Aurora\Modules\SharedFiles\Enums;

class Access extends \Aurora\System\Enums\AbstractEnumeration
{
    public const NoAccess = 0;
    public const Write	 = 1;
    public const Read   = 2;
    public const Reshare = 3;

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
