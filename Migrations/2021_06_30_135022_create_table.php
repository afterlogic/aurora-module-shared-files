<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Capsule\Manager as Capsule;

class CreateTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        $sPrefix = Capsule::connection()->getTablePrefix();

        $sSql = str_replace("%PREFIX%", $sPrefix,
"CREATE TABLE IF NOT EXISTS `%PREFIX%adav_sharedfiles` (
	`id` int(11) NOT NULL AUTO_INCREMENT,
	`storage` varchar(255) DEFAULT NULL,
	`path` varchar(255) DEFAULT NULL,
	`uid` varchar(255) DEFAULT NULL,
	`owner` varchar(255) DEFAULT NULL,
	`principaluri` varchar(255) DEFAULT NULL,
	`access` int(11) DEFAULT NULL,
	`isdir` tinyint(1) DEFAULT '0',
	PRIMARY KEY (`id`)
)
ENGINE=InnoDB
DEFAULT CHARSET=utf8
COLLATE='utf8_general_ci';");
        Capsule::connection()->statement($sSql);
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Capsule::schema()->dropIfExists('adav_sharedfiles');
    }
}
