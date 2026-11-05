-- Dedicated destructive legacy-upgrade fixture, separate from the API suite.
CREATE DATABASE IF NOT EXISTS ticketsystem_migration_test
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON ticketsystem_migration_test.* TO 'ticketsystem'@'%';
