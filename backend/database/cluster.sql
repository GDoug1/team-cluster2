CREATE DATABASE IF NOT EXISTS official_hris_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_general_ci;

USE official_hris_db;

CREATE TABLE IF NOT EXISTS roles (
  role_id INT(11) NOT NULL AUTO_INCREMENT,
  role_name VARCHAR(50) NOT NULL,
  role_description VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS users (
  user_id INT(11) NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) DEFAULT NULL,
  password VARCHAR(255) NOT NULL,
  role_id INT(11) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY email (email),
  KEY fk_users_roles (role_id),
  CONSTRAINT fk_users_roles FOREIGN KEY (role_id) REFERENCES roles (role_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS employees (
  employee_id INT(11) NOT NULL AUTO_INCREMENT,
  user_id INT(11) NOT NULL,
  first_name VARCHAR(50) NOT NULL,
  middle_name VARCHAR(50) DEFAULT NULL,
  last_name VARCHAR(50) NOT NULL,
  address VARCHAR(255) DEFAULT NULL,
  birthdate DATE DEFAULT NULL,
  email VARCHAR(100) NOT NULL,
  position VARCHAR(50) DEFAULT NULL,
  cluster VARCHAR(100) DEFAULT NULL,
  contact_number VARCHAR(20) DEFAULT NULL,
  employment_status VARCHAR(20) DEFAULT NULL,
  employee_type VARCHAR(30) DEFAULT NULL,
  date_hired DATE NOT NULL,
  PRIMARY KEY (employee_id),
  KEY fk_emp_users (user_id),
  CONSTRAINT fk_emp_users FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS clusters (
  cluster_id INT(11) NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT NULL,
  user_id INT(11) NOT NULL,
  status ENUM('pending', 'active', 'rejected') DEFAULT 'pending',
  rejection_reason TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cluster_id),
  KEY fk_clusters_users (user_id),
  CONSTRAINT fk_clusters_users FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS cluster_members (
  cluster_id INT(11) NOT NULL,
  employee_id INT(11) NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cluster_id, employee_id),
  KEY fk_cm_emp (employee_id),
  CONSTRAINT fk_cm_cluster FOREIGN KEY (cluster_id) REFERENCES clusters (cluster_id) ON DELETE CASCADE,
  CONSTRAINT fk_cm_emp FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS announcements (
  announcement_id INT(11) NOT NULL AUTO_INCREMENT,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  posted_by INT(11) NOT NULL,
  date_posted DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (announcement_id),
  KEY fk_ann_users (posted_by),
  CONSTRAINT fk_ann_users FOREIGN KEY (posted_by) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS attendance_logs (
  attendance_id INT(11) NOT NULL AUTO_INCREMENT,
  cluster_id INT(11) DEFAULT NULL,
  employee_id INT(11) NOT NULL,
  timelog_id INT(11) DEFAULT NULL,
  note TEXT DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  attendance_date DATE NOT NULL,
  attendance_status ENUM('Present', 'Absent', 'Late', 'Overtime', 'On Leave') NOT NULL,
  PRIMARY KEY (attendance_id),
  KEY fk_att_cluster (cluster_id),
  KEY fk_att_emp (employee_id),
  CONSTRAINT fk_att_cluster FOREIGN KEY (cluster_id) REFERENCES clusters (cluster_id) ON DELETE SET NULL,
  CONSTRAINT fk_att_emp FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS attendance_disputes (
  dispute_id INT(11) NOT NULL AUTO_INCREMENT,
  cluster_id INT(11) DEFAULT NULL,
  employee_id INT(11) NOT NULL,
  dispute_date DATE NOT NULL,
  dispute_type VARCHAR(100) DEFAULT NULL,
  reason TEXT NOT NULL,
  status ENUM('Pending', 'Endorsed', 'Approved', 'Denied') DEFAULT 'Pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  remarks TEXT DEFAULT NULL,
  PRIMARY KEY (dispute_id),
  KEY fk_ad_cluster (cluster_id),
  KEY fk_ad_emp (employee_id),
  CONSTRAINT fk_ad_cluster FOREIGN KEY (cluster_id) REFERENCES clusters (cluster_id) ON DELETE SET NULL,
  CONSTRAINT fk_ad_emp FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS leave_requests (
  leave_id INT(11) NOT NULL AUTO_INCREMENT,
  employee_id INT(11) NOT NULL,
  leave_type VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT DEFAULT NULL,
  status VARCHAR(50) DEFAULT 'Pending',
  reviewed_by INT(11) DEFAULT NULL,
  approved_by INT(11) DEFAULT NULL,
  agreement_1 TINYINT(1) DEFAULT 0,
  agreement_2 TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  remarks TEXT DEFAULT NULL,
  PRIMARY KEY (leave_id),
  KEY fk_lr_emp (employee_id),
  KEY fk_lr_rev (reviewed_by),
  KEY fk_lr_app (approved_by),
  CONSTRAINT fk_lr_app FOREIGN KEY (approved_by) REFERENCES users (user_id) ON DELETE SET NULL,
  CONSTRAINT fk_lr_emp FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE,
  CONSTRAINT fk_lr_rev FOREIGN KEY (reviewed_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS overtime_requests (
  ot_id INT(11) NOT NULL AUTO_INCREMENT,
  employee_id INT(11) NOT NULL,
  ot_type ENUM('Regular Overtime', 'Duty on Rest Day', 'Duty on Rest Day OT') NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  purpose TEXT NOT NULL,
  approved_by INT(11) DEFAULT NULL,
  agreement_1 TINYINT(1) NOT NULL DEFAULT 0,
  agreement_2 TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('Pending', 'Endorsed', 'Approved', 'Denied') DEFAULT 'Pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  remarks TEXT DEFAULT NULL,
  PRIMARY KEY (ot_id),
  KEY fk_ot_emp (employee_id),
  CONSTRAINT fk_ot_emp FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS schedules (
  schedule_id INT(11) NOT NULL AUTO_INCREMENT,
  cluster_id INT(11) DEFAULT NULL,
  employee_id INT(11) NOT NULL,
  day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') DEFAULT NULL,
  shift_type ENUM('Morning', 'Mid', 'Night') DEFAULT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  work_setup ENUM('Onsite', 'WFH', 'Hybrid') DEFAULT NULL,
  breaksched_start DATETIME DEFAULT NULL,
  breaksched_end DATETIME DEFAULT NULL,
  PRIMARY KEY (schedule_id),
  KEY fk_sched_cluster (cluster_id),
  KEY fk_sched_emp (employee_id),
  CONSTRAINT fk_sched_cluster FOREIGN KEY (cluster_id) REFERENCES clusters (cluster_id) ON DELETE SET NULL,
  CONSTRAINT fk_sched_emp FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS time_logs (
  time_log_id INT(11) NOT NULL AUTO_INCREMENT,
  employee_id INT(11) NOT NULL,
  user_id INT(11) NOT NULL,
  attendance_id INT(11) NOT NULL,
  time_in DATETIME DEFAULT NULL,
  time_out DATETIME DEFAULT NULL,
  break_start DATETIME DEFAULT NULL,
  break_end DATETIME DEFAULT NULL,
  total_hours DOUBLE(5, 2) DEFAULT NULL,
  log_date DATE DEFAULT NULL,
  PRIMARY KEY (time_log_id),
  KEY fk_tl_emp (employee_id),
  KEY fk_tl_user (user_id),
  KEY fk_tl_att (attendance_id),
  CONSTRAINT fk_tl_att FOREIGN KEY (attendance_id) REFERENCES attendance_logs (attendance_id) ON DELETE CASCADE,
  CONSTRAINT fk_tl_emp FOREIGN KEY (employee_id) REFERENCES employees (employee_id) ON DELETE CASCADE,
  CONSTRAINT fk_tl_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS break_logs (
  cluster_id INT(11) NOT NULL,
  time_log_id INT(11) NOT NULL,
  break_start DATETIME NOT NULL,
  break_end DATETIME DEFAULT NULL,
  total_break_hour DOUBLE DEFAULT NULL,
  PRIMARY KEY (cluster_id),
  KEY fk_bl_tl (time_log_id),
  CONSTRAINT fk_bl_tl FOREIGN KEY (time_log_id) REFERENCES time_logs (time_log_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
