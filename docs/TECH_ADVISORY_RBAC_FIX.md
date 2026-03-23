# Technical Advisory: RBAC Security Fix & Database Schema Repair

**Date:** March 23, 2026
**Status:** High Priority / Critical Fix
**Topics:** Security, RBAC, Database Schema Integrity

---

## 🛑 Problem Overview

During QA testing, a critical security vulnerability was discovered where certain **Employee** and **Coach** accounts could access the **Super Admin Control Panel** and view restricted employee data.

### Root Causes
1.  **Broken Table Constraints:** The `user_permissions` table used single-column `UNIQUE` keys for `user_id` and `permission_id`. This limited the system to one override per user and one user per restricted permission, causing data collisions and preventing proper permission denials.
2.  **Over-privileged Seeding:** Default database seeding scripts (`schema.sql`) incorrectly granted administrative permissions to non-admin roles in some versions.
3.  **Frontend Logic Gap:** Certain administrative UI sections were missing explicit permission checks, relying solely on state-based navigation.

---

## ✅ Applied Fixes

### 1. Database Schema Hardening
The `user_permissions` table has been repaired to use a **Composite Unique Key** (`user_id`, `permission_id`). This allows for unlimited, granular overrides per user.

**New Index Structure:**
```sql
ALTER TABLE `user_permissions` ADD UNIQUE KEY `uniq_user_permission` (`user_id`, `permission_id`);
```

### 2. Standardized Role Permissions
Role permissions have been strictly audited and reset to standard RBAC levels:
*   **Employee (Role 4):** Restricted to `View Dashboard`, `View Team`, and `View Attendance`.
*   **Team Coach (Role 3):** Restricted to `Set/Edit Attendance`, `View Dashboard`, `View Team`, and `View Attendance`. (Removed: `Access Control Panel`, `View Employee List`).

### 3. Frontend Protection
The `EmployeesSection` and `ControlPanelSection` in `EmployeeDashboard.jsx` now strictly enforce the `canAccessEmployeesTab` and `canAccessControlPanel` flags retrieved from the RBAC system.

---

## 🛠️ Action Required for Developers

To synchronize your local development environment and prevent unauthorized access, please follow these steps:

### 1. Update your Branch
```bash
git fetch upstream
git checkout Attendance
git pull upstream Attendance
```

### 2. Repair your Local Database
You **must** apply the schema fix to your local `system_hris_db`. Choose ONE method:

*   **Option A (Fastest):** Import the fix script directly:
    `docs/db/fix_user_permissions_schema.sql`
*   **Option B (Clean Slate):** Re-import the entire updated schema:
    `docs/db/schema.sql`

### 3. Verify Account Access
Login with the new QA accounts to confirm restrictions are active:
*   **Employee:** `qa_employee@mail.com` / `QA_Pass123!`
*   **Coach:** `qa_coach@mail.com` / `QA_Pass123!`

---

## 🚩 Reporting Vulnerabilities
If you discover any other instances where a lower-level role can see administrative tools, please document it in the `QA_EXECUTION_GUIDE.md` and alert the security lead immediately.
