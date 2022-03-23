<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Capsule\Manager as Capsule;

class AlterAdavSharedfilesTableCreateIndexes extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Capsule::schema()->table('adav_sharedfiles', function(Blueprint $table)
        {
            $table->index('owner');
            $table->index('principaluri');
            $table->index('initiator');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Capsule::schema()->table('adav_sharedfiles', function (Blueprint $table)
        {
            $table->dropIndex(['owner']);
            $table->dropIndex(['principaluri']);
            $table->dropIndex(['initiator']);
        });
    }
}
