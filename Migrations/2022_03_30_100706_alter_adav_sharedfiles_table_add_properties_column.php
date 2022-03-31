<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Capsule\Manager as Capsule;

class AlterAdavSharedfilesTableAddPropertiesColumn extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        $prefix = Capsule::connection()->getTablePrefix();
        Capsule::statement("ALTER TABLE {$prefix}adav_sharedfiles ADD `Properties` json");
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        $prefix = Capsule::connection()->getTablePrefix();
        Capsule::statement("ALTER TABLE {$prefix}adav_sharedfiles DROP COLUMN `Properties`");
    }
}
