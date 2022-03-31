<?php

namespace Aurora\Modules\SharedFiles\Models;

use \Aurora\System\Classes\Model;

class SharedFile extends Model
{
    protected $table = 'adav_sharedfiles';

    /**
     * The primary key for the model.
     *
     * @var string
     */
    protected $primaryKey = 'id';

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'id',
        'storage',
        'path',
        'uid',
        'owner',
        'principaluri',
        'initiator',
        'access',
        'isdir',
        'share_path',
        'group_id',
        'Properties'
    ];

    /**
     * The attributes that should be hidden for arrays.
     *
     * @var array
     */
    protected $hidden = [
    ];

    protected $casts = [
        'Properties' => 'array',
    ];

    protected $attributes = [
    ];

    protected $appends = [
    ];

    public $timestamps = false;
}