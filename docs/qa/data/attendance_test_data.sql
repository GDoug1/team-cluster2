-- --------------------------------------------------------
-- ATTENDANCE MODULE COMPREHENSIVE TEST DATA (SAFER VERSION)
-- Target Date: Monday, March 16, 2026
-- --------------------------------------------------------

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;

-- 1. CLUSTER MEMBERSHIP
-- Ensure employees 3, 6, 7, and 8 are part of Team 1 (Cluster ID: 1)
INSERT IGNORE INTO `cluster_members` (`cluster_id`, `employee_id`, `assigned_at`) VALUES
(1, 3, '2026-03-12 08:00:00'),
(1, 6, '2026-03-12 08:00:00'),
(1, 7, '2026-03-13 08:00:00'),
(1, 8, '2026-03-15 08:00:00');

-- 2. WEEKLY SCHEDULES
-- Omit schedule_id to allow AUTO_INCREMENT
INSERT INTO `schedules` (`cluster_id`, `employee_id`, `day_of_week`, `shift_type`, `start_time`, `end_time`, `work_setup`) VALUES
(1, 3, 'Monday', 'Morning', '09:00:00', '18:00:00', 'Hybrid'),
(1, 6, 'Monday', 'Morning', '09:00:00', '18:00:00', 'WFH'),
(1, 7, 'Monday', 'Mid', '13:00:00', '22:00:00', 'Onsite'),
(1, 8, 'Monday', 'Night', '22:00:00', '07:00:00', 'Onsite');

-- 3. ATTENDANCE & TIME LOGS (Linked via variables)

-- TEST CASE 1: Employee 2 (Present - On Time)
INSERT INTO `attendance_logs` (`cluster_id`, `employee_id`, `note`, `attendance_date`, `attendance_status`) 
VALUES (1, 2, 'Regular Shift - On Time', '2026-03-16', 'Present');
SET @att_id_2 = LAST_INSERT_ID();

INSERT INTO `time_logs` (`user_id`, `employee_id`, `attendance_id`, `time_in`, `time_out`, `total_hours`, `log_date`, `tag`) 
VALUES (2, 2, @att_id_2, '2026-03-16 08:50:00', '2026-03-16 18:05:00', 9.25, '2026-03-16', 'On Time');
SET @time_id_2 = LAST_INSERT_ID();

UPDATE `attendance_logs` SET `timelog_id` = @time_id_2 WHERE `attendance_id` = @att_id_2;

-- TEST CASE 2: Employee 3 (Late + Dispute)
INSERT INTO `attendance_logs` (`cluster_id`, `employee_id`, `note`, `attendance_date`, `attendance_status`) 
VALUES (1, 3, 'Late due to ISP maintenance', '2026-03-16', 'Late');
SET @att_id_3 = LAST_INSERT_ID();

INSERT INTO `time_logs` (`user_id`, `employee_id`, `attendance_id`, `time_in`, `time_out`, `total_hours`, `log_date`, `tag`) 
VALUES (3, 3, @att_id_3, '2026-03-16 09:45:00', '2026-03-16 18:45:00', 9.00, '2026-03-16', 'Late');
SET @time_id_3 = LAST_INSERT_ID();

UPDATE `attendance_logs` SET `timelog_id` = @time_id_3 WHERE `attendance_id` = @att_id_3;

-- TEST CASE 3: Employee 7 (Overtime)
INSERT INTO `attendance_logs` (`cluster_id`, `employee_id`, `note`, `attendance_date`, `attendance_status`) 
VALUES (1, 7, 'Extended shift for month-end reports', '2026-03-16', 'Overtime');
SET @att_id_7 = LAST_INSERT_ID();

INSERT INTO `time_logs` (`user_id`, `employee_id`, `attendance_id`, `time_in`, `time_out`, `total_hours`, `log_date`, `tag`) 
VALUES (7, 7, @att_id_7, '2026-03-16 12:55:00', '2026-03-17 01:00:00', 12.08, '2026-03-16', 'On Time');
SET @time_id_7 = LAST_INSERT_ID();

UPDATE `attendance_logs` SET `timelog_id` = @time_id_7 WHERE `attendance_id` = @att_id_7;

-- TEST CASE 4: Employee 6 (Absent)
INSERT INTO `attendance_logs` (`cluster_id`, `employee_id`, `note`, `attendance_date`, `attendance_status`) 
VALUES (1, 6, 'Unplanned absence', '2026-03-16', 'Absent');

-- TEST CASE 5: Employee 8 (On Leave)
INSERT INTO `attendance_logs` (`cluster_id`, `employee_id`, `note`, `attendance_date`, `attendance_status`) 
VALUES (1, 8, 'Vacation Leave', '2026-03-16', 'On Leave');

-- 4. BREAK LOGS (Linked to Time Logs)
INSERT INTO `break_logs` (`time_log_id`, `cluster_id`, `break_start`, `break_end`, `total_break_hour`) VALUES
(@time_id_2, 1, '2026-03-16 12:00:00', '2026-03-16 13:00:00', 1.00),
(@time_id_3, 1, '2026-03-16 13:00:00', '2026-03-16 14:00:00', 1.00);

-- 5. ATTENDANCE DISPUTES
INSERT INTO `attendance_disputes` (`cluster_id`, `employee_id`, `dispute_date`, `dispute_type`, `reason`, `status`, `created_at`) VALUES
(1, 3, '2026-03-16', 'Late', 'Internet was down in the area from 8:30 AM to 9:30 AM. Ticket #12345.', 'Pending', '2026-03-16 11:00:00');

-- 6. HOLIDAYS
INSERT INTO `holidays` (`holiday_name`, `holiday_date`) VALUES
('Sample Company Holiday', '2026-03-20');

COMMIT;

