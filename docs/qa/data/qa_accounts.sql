-- SQL Script to generate QA accounts for each role
-- Default Password for all: QA_Pass123!
-- Hashed Password: $2y$10$rzVy4APBDl47NS8yIgd1UuLTuze2OCQyPnQ2cLkcJW262Y79UC3ji

SET AUTOCOMMIT = 0;
START TRANSACTION;

-- 1. Super Admin (role_id: 1)
INSERT IGNORE INTO `users` (`email`, `password`, `role_id`, `created_at`) 
VALUES ('qa_superadmin@mail.com', '$2y$10$rzVy4APBDl47NS8yIgd1UuLTuze2OCQyPnQ2cLkcJW262Y79UC3ji', 1, NOW());
SET @user_id_sa = (SELECT user_id FROM users WHERE email = 'qa_superadmin@mail.com');
INSERT IGNORE INTO `employees` (`user_id`, `first_name`, `last_name`, `email`, `position`, `employment_status`, `employee_type`, `date_hired`) 
VALUES (@user_id_sa, 'QA', 'SuperAdmin', 'qa_superadmin@mail.com', 'Super Admin', 'Active', 'Regular', CURDATE());

-- 2. Admin (role_id: 2)
INSERT IGNORE INTO `users` (`email`, `password`, `role_id`, `created_at`) 
VALUES ('qa_admin@mail.com', '$2y$10$rzVy4APBDl47NS8yIgd1UuLTuze2OCQyPnQ2cLkcJW262Y79UC3ji', 2, NOW());
SET @user_id_admin = (SELECT user_id FROM users WHERE email = 'qa_admin@mail.com');
INSERT IGNORE INTO `employees` (`user_id`, `first_name`, `last_name`, `email`, `position`, `employment_status`, `employee_type`, `date_hired`) 
VALUES (@user_id_admin, 'QA', 'Admin', 'qa_admin@mail.com', 'Admin', 'Active', 'Regular', CURDATE());

-- 3. Team Coach (role_id: 3)
INSERT IGNORE INTO `users` (`email`, `password`, `role_id`, `created_at`) 
VALUES ('qa_coach@mail.com', '$2y$10$rzVy4APBDl47NS8yIgd1UuLTuze2OCQyPnQ2cLkcJW262Y79UC3ji', 3, NOW());
SET @user_id_coach = (SELECT user_id FROM users WHERE email = 'qa_coach@mail.com');
INSERT IGNORE INTO `employees` (`user_id`, `first_name`, `last_name`, `email`, `position`, `employment_status`, `employee_type`, `date_hired`) 
VALUES (@user_id_coach, 'QA', 'Coach', 'qa_coach@mail.com', 'Team Coach', 'Active', 'Regular', CURDATE());

-- 4. Employee (role_id: 4)
INSERT IGNORE INTO `users` (`email`, `password`, `role_id`, `created_at`) 
VALUES ('qa_employee@mail.com', '$2y$10$rzVy4APBDl47NS8yIgd1UuLTuze2OCQyPnQ2cLkcJW262Y79UC3ji', 4, NOW());
SET @user_id_emp = (SELECT user_id FROM users WHERE email = 'qa_employee@mail.com');
INSERT IGNORE INTO `employees` (`user_id`, `first_name`, `last_name`, `email`, `position`, `employment_status`, `employee_type`, `date_hired`) 
VALUES (@user_id_emp, 'QA', 'Employee', 'qa_employee@mail.com', 'Employee', 'Active', 'Regular', CURDATE());

COMMIT;
