<?php
// Copy this file to config.php and fill in your Hostinger details.
// hPanel → Databases → MySQL Databases shows the database name, user and host.
return [
    'db_host' => 'localhost',
    'db_name' => 'u123456789_redipos',
    'db_user' => 'u123456789_redipos',
    'db_pass' => 'CHANGE-ME',

    // A long random secret. Type the same value in Redi POS → Settings → Cloud backup.
    // Make one at https://www.random.org/strings/ or run: php -r "echo bin2hex(random_bytes(24));"
    'api_key' => 'CHANGE-ME-TO-A-LONG-RANDOM-SECRET',

    // The web addresses allowed to talk to this API (your Vercel / own domain).
    // Use ['*'] only while testing.
    'allowed_origins' => [
        'https://your-project.vercel.app',
        'https://pos.yourshop.lk',
    ],
];
