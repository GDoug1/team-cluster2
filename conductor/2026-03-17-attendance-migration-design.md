# Design: Attendance Module Migration (Phase 1)

## Objective
Migrate the Attendance Module from `HRIS_Test` to `team-cluster2`. This includes updating the backend to provide full clock-in/out and break data, and converting the frontend from Tailwind/TypeScript to Vanilla CSS/JavaScript.

## 1. Backend: Refined Attendance API
**File:** `backend/api/employee/employee_attendance_history.php`

The current script is a hybrid of legacy and new checks. We will refactor it to strictly follow the `system_hris_db` schema provided, ensuring it returns all fields needed for the new UI.

### Data Mapping
- `date` -> `attendance_logs.attendance_date`
- `time_in` -> `time_logs.time_in`
- `time_out` -> `time_logs.time_out`
- `break_in` -> `time_logs.break_start`
- `break_out` -> `time_logs.break_end`
- `total_hours` -> `time_logs.total_hours`
- `status` -> `attendance_logs.attendance_status`

### Logic
1. Get the `employee_id` from the `employees` table using `$_SESSION['user']['id']`.
2. Query `attendance_logs` joined with `time_logs` (via `timelog_id` or `attendance_id` depending on the bridge column).
3. Return the results as a JSON array.

## 2. Frontend: API & Hooks
**Files:**
- `frontend/src/api/attendance.js` (Update)
- `frontend/src/hooks/useAttendanceHistory.js` (New)

### API
Add `fetchAttendanceHistory()` using `apiFetch('api/employee/employee_attendance_history.php')`.

### Hook
`useAttendanceHistory()` will:
- Manage `data`, `loading`, and `error` states.
- Fetch data on mount.
- Provide a `refetch` function.

## 3. Frontend: Component & Styling
**Files:**
- `frontend/src/styles/AttendanceModule.css` (New)
- `frontend/src/components/AttendanceModule.jsx` (New)

### Conversion: Tailwind to Vanilla CSS
We will extract the Tailwind utility classes into semantic classes:
- `.attendance-container` (Layout)
- `.stats-grid`, `.stat-card` (Dashboard metrics)
- `.attendance-table-container`, `.attendance-table` (Log display)
- `.status-dot` (Status indicators)
- `.attendance-toolbar` (Search and filters)

### Component Adaptations
- Rename `AttendanceModule.tsx` to `AttendanceModule.jsx`.
- Remove TypeScript interfaces (converting to PropTypes if needed, but keeping it standard JS for consistency).
- Import the new Vanilla CSS file.
- Use `lucide-react` for icons.

## 4. Integration
**File:** `frontend/src/pages/EmployeeDashboard.jsx`

- Replace the current attendance view with `<AttendanceModule />`.
- Ensure the navigation state (`activeNav`) correctly triggers the display of this module.

## Verification Steps
1. **API Check:** Verify `backend/api/employee/employee_attendance_history.php` returns valid JSON with all 7 required fields.
2. **UI Check:** Verify the table displays data correctly (Date, Times, Status).
3. **Styling Check:** Ensure the layout remains consistent with the target project's design language.
4. **Regression Check:** Verify other roles (Admin/Coach) are not affected by these changes.

---
**Does this approach look correct to you?** I will proceed with the implementation plan once approved.
