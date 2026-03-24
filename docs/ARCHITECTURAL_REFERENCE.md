# Architectural Reference: Team Cluster 2

This document provides a high-fidelity map of the application's structure, patterns, and data flows. Use this as the primary source of truth for all code-related inquiries and modifications.

---

## 🏗 System Overview

**Team Cluster 2** is a role-based attendance and team management system.
- **Frontend:** React 19 (Vite 7) - Single Page Application (SPA).
- **Backend:** Monolithic PHP 8 (Procedural/OO hybrid) - RESTful API.
- **Database:** MySQL (mysqli) - `system_hris_db`.
- **Authentication:** PHP Session-based (`credentials: "include"`).

---

## 🏛 Core Design Patterns

### 1. The "State-Based Dashboard Orchestrator"
Each dashboard (`AdminDashboard.jsx`, `CoachDashboard.jsx`, etc.) acts as a top-level container that manages sub-navigation via internal state.
- **Pattern:** `const [activeNav, setActiveNav] = useState('attendance');`
- **Module Swapping:** Components are rendered conditionally based on `activeNav`.
- **Primary Modules:**
  - `attendance`: `AttendanceModule.jsx` (Real-time clocking and logs).
  - `employees`: `EmployeesSection.jsx` (Employee management/CRUD).
  - `profile`: `ProfileSection.jsx` (User profile settings).
  - `control-panel`: `ControlPanelSection.jsx` (RBAC/System logs).
  - `filing-center`: `FilingCenterPanel.jsx` (Requests for leave/overtime).

### 2. Unified API Wrapper (`apiFetch`)
Found in `frontend/src/api/api.js`.
- **Base URL:** Dynamically resolved from `VITE_API_BASE_URL` or defaults to `http://localhost/team-cluster2/backend`.
- **Auth:** Hardcoded `credentials: "include"` for session persistence.
- **GET Safety:** Automatically appends `_ts` timestamps to bypass browser/proxy caches.

### 3. Granular RBAC (Role-Based Access Control)
- **Backend:** `backend/config/auth.php` exports `requirePermission($perm)`.
- **Frontend:** `usePermissions()` hook fetches permission strings from `auth/my_permissions.php`.
- **Feature Translation:** `getFeatureAccess(hasPermission)` in `utils/featureAccess.js` converts permission strings (e.g., "View Team") into boolean flags (e.g., `canViewTeam`).

---

## 📂 Detailed Directory Structure

### 🌐 Frontend (`frontend/src/`)
```text
src/
├── api/                # API Client Layer
│   ├── api.js          # Core fetch wrapper (apiFetch)
│   ├── attendance.js   # Attendance endpoints
│   ├── requests.js     # Leave/Overtime request endpoints
│   └── profile.js      # User profile updates
├── components/         # UI Modules (Self-contained)
│   ├── AttendanceModule.jsx      # Clocking/Logs UI
│   ├── FilingCenterPanel.jsx    # Request forms/history
│   ├── EmployeesSection.jsx     # Admin employee management
│   ├── ControlPanelSection.jsx  # Permissions/System logs
│   ├── Sidebar/                 # Dashboard navigation (Sidebar/Responsive)
│   └── shared/                  # Common UI (StatCard, SortableHeader)
├── hooks/              # Business Logic & State
│   ├── usePermissions.js        # Auth state & RBAC flags
│   ├── useCurrentUser.js        # User profile & role state
│   └── useAttendanceHistory.js  # Data fetching for logs
├── pages/              # Main Route Entry Points
│   ├── AdminDashboard.jsx       # SuperAdmin/Admin landing
│   ├── CoachDashboard.jsx       # Coach landing
│   └── EmployeeDashboard.jsx    # Base employee landing
├── routes/             # Navigation Guarding
│   └── ProtectedRoute.jsx       # Role/Auth gatekeeper
└── utils/              # Utility & Constants
    ├── featureAccess.js         # Permission-to-Flag mapper
    └── dateUtils.js             # Shared date formatting
```

### 🐘 Backend (`backend/`)
```text
backend/
├── api/                # REST-ish Endpoints
│   ├── admin/          # Role: Admin/Super Admin
│   │   ├── employee_management.php  # CRUD for employees
│   │   ├── approve_cluster.php     # Team approval
│   │   └── control_panel/          # RBAC & System Tools
│   ├── coach/          # Role: Coach
│   │   ├── manage_members.php      # Team roster management
│   │   └── save_schedule.php       # Schedule assignment
│   ├── employee/       # Role: Employee
│   │   └── save_attendance.php     # Punching in/out
│   ├── shared/         # Multi-role endpoints
│   │   ├── create_request.php      # Leave/Overtime filing
│   │   └── profile.php             # Self-update profile
│   └── utils/          # Core Helpers
│       └── logger.php              # Centralized activity logging
├── auth/               # Session & Identity
│   ├── login.php       # POST login (Set Session)
│   ├── me.php          # GET current session identity
│   └── my_permissions.php # GET current session permissions
└── config/             # System Configuration
    ├── database.php    # MySQLi connection singleton
    └── auth.php        # RBAC Middleware & Security logic
```

---

## 📊 Database Schema Highlights

| Table | Primary Role | Key Foreign Keys |
| :--- | :--- | :--- |
| `users` | Auth credentials | `id` |
| `employees` | Profile information | `user_id` -> `users.id` |
| `roles` | Access levels | `id` |
| `permissions` | Action definitions | `id` |
| `role_permissions`| RBAC Mapping | `role_id`, `permission_id` |
| `clusters` | Team organization | `coach_id` -> `employees.id` |
| `attendance_logs`| Clock-in/out data | `employee_id`, `cluster_id` |
| `leave_requests` | PTO/Leave management | `employee_id`, `approved_by` |
| `activity_logs` | Audit trail | `user_id` |

---

## 🔄 Core Data Flows

### 1. Clock-In Sequence
1. **Trigger:** User clicks "Punch In" in `AttendanceModule.jsx`.
2. **API:** Calls `saveAttendance()` in `src/api/attendance.js`.
3. **Backend:** `backend/api/employee/save_attendance.php` receives data.
4. **Validation:** Checks if user is already timed in via `attendance_logs`.
5. **Mutation:** Inserts `IN` record with current timestamp and location data.
6. **Audit:** `logAction()` records "Punch In" for the user.
7. **UI:** Module refreshes local state to show "Punch Out" button.

### 2. Permission Updates
1. **Trigger:** Admin changes a permission in `ControlPanelSection.jsx`.
2. **Mutation:** `backend/api/admin/control_panel/permissions.php` updates `role_permissions`.
3. **Event:** Frontend emits `window.dispatchEvent(new CustomEvent('permissions-updated'))`.
4. **Refresh:** `usePermissions()` hook re-fetches from `auth/my_permissions.php`.
5. **Update:** UI components re-evaluate `getFeatureAccess()` and hide/show tabs instantly.

---

## 🛠 Conventions & Standards

### 🛠 Conventions & Standards

#### 1. Git & Commit Standards
Adhere to the following standards for all source control operations:
- **Commit Message Convention:** Use a prefix-based format:
  - `feat:` for new features or significant UI updates.
  - `fix:` for bug fixes.
  - `chore:` for maintenance, dependencies, or configuration changes.
  - `doc:` for documentation updates.
  - `perf:` for performance improvements.
  - `refactor:` for code restructuring without behavioral changes.
- **Mood & Tense:** Use the **imperative mood** (present tense). (e.g., `fix: restore counter` instead of `fix: restored counter`).
- **Branching Strategy:** Proactively create a new branch for features (`feat/name`) or major refactors (`refactor/name`) to maintain `main` branch stability.

#### 2. Naming
- **React Components:** PascalCase (`AttendanceCard.jsx`).
- **PHP Endpoints:** snake_case (`save_attendance.php`).
- **CSS Classes:** kebab-case (`.dashboard-container`).
- **Database:** snake_case for tables and columns.

### Security Non-Negotiables
- **API Tops:** Every PHP API file MUST start with:
  ```php
  require_once '../../config/auth.php';
  requirePermission('Specific Permission'); // Or requireRole
  ```
- **Session Truth:** Never trust `user_id` passed from the frontend; always use `$_SESSION['user_id']`.

### Navigation State Shape
The `activeNav` state in dashboards uses these exact string keys:
`['attendance', 'team', 'employees', 'filing-center', 'profile', 'control-panel']`.

---

## 📝 How to Prompt with this Doc
When asking for changes, reference this document to skip exploratory phases:
> *"Using the **State-Based Dashboard Orchestrator** pattern described in `docs/ARCHITECTURAL_REFERENCE.md`, add a new module 'Compliance' to the `AdminDashboard.jsx` and create a corresponding `ComplianceSection.jsx` component."*

> *"Following the **Unified API Wrapper** and **Granular RBAC** patterns, implement a new endpoint in `backend/api/admin/` for bulk exporting attendance logs."*
