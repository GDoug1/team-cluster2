-- SQL Script to fix the fundamentally broken user_permissions table schema.
-- This removes the single-column UNIQUE constraints that were blocking proper permission overrides.

SET AUTOCOMMIT = 0;
START TRANSACTION;

-- 1. Drop existing foreign keys that rely on the bad indexes
ALTER TABLE `user_permissions` DROP FOREIGN KEY `user_permissions_ibfk_1`;
ALTER TABLE `user_permissions` DROP FOREIGN KEY `user_permissions_ibfk_2`;

-- 2. Drop the incorrect single-column unique indexes
ALTER TABLE `user_permissions` DROP INDEX `user_id`;
ALTER TABLE `user_permissions` DROP INDEX `permission_id`;

-- 3. Add proper non-unique lookups for the foreign keys
ALTER TABLE `user_permissions` ADD INDEX `idx_user_permissions_user_id` (`user_id`);
ALTER TABLE `user_permissions` ADD INDEX `idx_user_permissions_permission_id` (`permission_id`);

-- 4. Add the correct composite unique index (one override per user per permission)
ALTER TABLE `user_permissions` ADD UNIQUE KEY `uniq_user_permission` (`user_id`, `permission_id`);

-- 5. Re-add foreign keys
ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`);
ALTER TABLE `user_permissions` ADD CONSTRAINT `user_permissions_ibfk_2` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`permission_id`);

COMMIT;
