<?php

return [
    'disk' => env('BACKUP_DISK', 'local'),
    'path' => trim((string) env('BACKUP_PATH', 'navkwabuild-backups'), '/'),
    'daily_at' => env('BACKUP_DAILY_AT', '02:00'),
];
