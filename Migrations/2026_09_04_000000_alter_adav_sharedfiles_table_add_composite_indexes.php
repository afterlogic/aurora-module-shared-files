<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Capsule\Manager as Capsule;

class AlterAdavSharedfilesTableAddCompositeIndexes extends Migration
{
    public function up()
    {
        $connection = Capsule::connection();
        $prefix = $connection->getTablePrefix();
        $table = $prefix . 'adav_sharedfiles';

        $indexes = [
            'adav_sharedfiles_owner_storage_path_index' => ['owner', 'storage', 'path'],
            'adav_sharedfiles_principaluri_uid_share_path_index' => ['principaluri', 'uid', 'share_path'],
        ];

        foreach ($indexes as $indexName => $columns) {
            $exists = $connection->select(
                "SHOW INDEX FROM `{$table}` WHERE Key_name = ?",
                [$indexName]
            );

            if (empty($exists)) {
                Capsule::schema()->table('adav_sharedfiles', function (Blueprint $table) use ($columns, $indexName) {
                    $table->index($columns, $indexName);
                });
            }
        }
    }

    public function down()
    {
        $connection = Capsule::connection();
        $prefix = $connection->getTablePrefix();
        $table = $prefix . 'adav_sharedfiles';

        $indexes = [
            'adav_sharedfiles_owner_storage_path_index',
            'adav_sharedfiles_principaluri_uid_share_path_index',
        ];

        foreach ($indexes as $indexName) {
            $exists = $connection->select(
                "SHOW INDEX FROM `{$table}` WHERE Key_name = ?",
                [$indexName]
            );

            if (!empty($exists)) {
                Capsule::schema()->table('adav_sharedfiles', function (Blueprint $table) use ($indexName) {
                    $table->dropIndex($indexName);
                });
            }
        }
    }
}
