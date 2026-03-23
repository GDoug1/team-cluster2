-- Fix role_permissions to strictly adhere to RBAC standards
-- This script removes unauthorized permissions from Team Coach and Employee roles.

SET AUTOCOMMIT = 0;
START TRANSACTION;

-- 1. Clear existing role_permissions for Coach and Employee to ensure a clean state
DELETE FROM `role_permissions` WHERE `role_id` IN (3, 4);

-- 2. Re-assign correct permissions for Team Coach (role_id: 3)
-- Standard Coach permissions: Set Attendance (4), Edit Attendance (5), View Dashboard (6), View Team (7), View Attendance (8)
INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
(3, 4), (3, 5), (3, 6), (3, 7), (3, 8);

-- 3. Re-assign correct permissions for Employee (role_id: 4)
-- Standard Employee permissions: View Dashboard (6), View Team (7), View Attendance (8)
INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
(4, 6), (4, 7), (4, 8);

-- 4. Verify no illegal overrides exist in user_permissions for these roles
-- (Note: My previous check only found one deny override for user 2, which is safe)

COMMIT;
