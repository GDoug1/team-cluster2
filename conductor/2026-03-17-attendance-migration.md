# Attendance Module Migration Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the standalone Attendance Module from the prototype into the main Team Cluster 2 project, ensuring full compatibility with the existing database schema and replacing Tailwind with Vanilla CSS.

**Architecture:** We will adopt a 3-tier frontend approach: a Vanilla CSS stylesheet, a custom React Hook (`useAttendanceHistory`) wrapping the `apiFetch` utility, and a self-contained React component (`AttendanceModule.jsx`) that drops seamlessly into the existing `EmployeeDashboard` orchestrator. The backend will be refactored to support the comprehensive data requirements (breaks, total hours) defined in the updated `system_hris_db` schema. *Crucially, we will strip out the standalone navigation sidebar from the prototype to integrate with the main app's existing layout.*

**Tech Stack:** React 19, Vanilla CSS, PHP 8.x, MySQL (mysqli).

---

### Task 1: Update Dependencies
**Goal:** Add required icon library to the frontend.

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install lucide-react**
```bash
cd frontend && npm install lucide-react
```
*Note: We are not installing Tailwind, as we are explicitly converting to Vanilla CSS.*

- [ ] **Step 2: Commit**
```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: add lucide-react dependency for attendance module icons"
```

---

### Task 2: Backend API Refactor
**Goal:** Refactor the PHP backend to return full time log details (breaks, total hours) as required by the new module, strictly adhering to the `system_hris_db` schema.

**Files:**
- Modify: `backend/api/employee/employee_attendance_history.php`

- [ ] **Step 1: Refactor SQL Query**
Update the script to perform a proper `LEFT JOIN` between `attendance_logs` and `time_logs`, ensuring all necessary columns are returned.

```php
<?php
include __DIR__ . "/../../config/database.php";
include __DIR__ . "/../../config/auth.php";
requireRole("employee");

$sessionUserId = (int)($_SESSION['user']['id'] ?? 0);

// Get employee_id from users table
$stmt = $conn->prepare("SELECT employee_id FROM employees WHERE user_id = ? LIMIT 1");
$stmt->bind_param('i', $sessionUserId);
$stmt->execute();
$res = $stmt->get_result();
$employee = $res->fetch_assoc();

if (!$employee) {
    echo json_encode(['error' => 'Employee record not found']);
    exit;
}

$employeeId = $employee['employee_id'];

// Fetch combined attendance and time logs
$sql = "SELECT 
            al.attendance_id,
            al.attendance_date as date,
            al.attendance_status as status,
            tl.time_in,
            tl.time_out,
            tl.break_start as break_in,
            tl.break_end as break_out,
            tl.total_hours
        FROM attendance_logs al
        LEFT JOIN time_logs tl ON al.attendance_id = tl.attendance_id
        WHERE al.employee_id = ?
        ORDER BY al.attendance_date DESC";

$stmt = $conn->prepare($sql);
$stmt->bind_param('i', $employeeId);
$stmt->execute();
$result = $stmt->get_result();

$logs = [];
while ($row = $result->fetch_assoc()) {
    $logs[] = [
        'date' => $row['date'] ?? date('Y-m-d'),
        'time_in' => $row['time_in'] ? date('h:i A', strtotime($row['time_in'])) : '--',
        'time_out' => $row['time_out'] ? date('h:i A', strtotime($row['time_out'])) : '--',
        'break_in' => $row['break_in'] ? date('h:i A', strtotime($row['break_in'])) : '--',
        'break_out' => $row['break_out'] ? date('h:i A', strtotime($row['break_out'])) : '--',
        'total_hours' => $row['total_hours'] ?? '0.00',
        'status' => strtolower($row['status'] ?? 'pending')
    ];
}

echo json_encode($logs);
```

- [ ] **Step 2: Commit**
```bash
git add backend/api/employee/employee_attendance_history.php
git commit -m "feat(api): refactor attendance history to include full time logs"
```

---

### Task 3: Frontend API & Hook
**Goal:** Create the data fetching layer using the existing `apiFetch` utility.

**Files:**
- Create: `frontend/src/hooks/useAttendanceHistory.js`
- Modify: `frontend/src/api/attendance.js`

- [ ] **Step 1: Update API Wrapper**
In `frontend/src/api/attendance.js`, add the fetch function:

```javascript
// Add to frontend/src/api/attendance.js
export const fetchAttendanceHistory = async () => {
  return await apiFetch("api/employee/employee_attendance_history.php");
};
```

- [ ] **Step 2: Create React Hook**
Create `frontend/src/hooks/useAttendanceHistory.js`:

```javascript
import { useState, useEffect, useCallback } from 'react';
import { fetchAttendanceHistory } from '../api/attendance';

export const useAttendanceHistory = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetchAttendanceHistory();
      if (response.error) throw new Error(response.error);
      setData(response);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load attendance records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { data, loading, error, refetch: loadData };
};
```

- [ ] **Step 3: Commit**
```bash
git add frontend/src/api/attendance.js frontend/src/hooks/useAttendanceHistory.js
git commit -m "feat(ui): add attendance history hook and api wrapper"
```

---

### Task 4: UI Styling (Tailwind to Vanilla CSS)
**Goal:** Extract the prototype's Tailwind styling into pure CSS.

**Files:**
- Create: `frontend/src/styles/AttendanceModule.css`

- [ ] **Step 1: Create Stylesheet**
Create the file with the following classes to replicate the exact look and feel of the prototype, omitting any layout wrapping that would interfere with the parent dashboard:

```css
/* frontend/src/styles/AttendanceModule.css */

.am-container {
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: am-fade-in 0.5s ease-out;
  position: relative;
}

@keyframes am-fade-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Stats Grid */
.am-stats-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 16px;
}

@media (min-width: 640px) {
  .am-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (min-width: 1280px) {
  .am-stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

.am-stat-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 24px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.am-stat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.am-stat-title {
  font-size: 14px;
  font-weight: 500;
  color: #020617;
  letter-spacing: -0.42px;
}

.am-stat-icon-wrapper {
  padding: 6px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.am-stat-icon-wrapper svg {
  color: #ffffff;
  width: 16px;
  height: 16px;
}

.am-stat-value {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.36px;
  color: #020617;
}

.am-stat-delta {
  font-size: 12px;
  color: #64748b;
}

/* Content Area */
.am-content-panel {
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  overflow: hidden;
  border: 1px solid #e2e8f0;
}

.am-toolbar {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-bottom: 1px solid #f1f5f9;
  background: #fafafa;
}

@media (min-width: 1280px) {
  .am-toolbar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.am-toolbar-title {
  font-size: 20px;
  font-weight: 400;
  color: rgba(0,0,0,0.85);
  margin: 0;
}

@media (min-width: 768px) {
  .am-toolbar-title { font-size: 24px; }
}

.am-toolbar-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
}

.am-btn-outline {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #ffffff;
  border: 1px solid #1890ff;
  color: #1890ff;
  border-radius: 2px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.am-btn-outline:hover {
  background: #f0f8ff;
}

.am-search-container {
  position: relative;
  flex: 1;
  min-width: 240px;
}

.am-search-input {
  width: 100%;
  padding: 8px 36px 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 2px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.am-search-input:focus {
  border-color: #1890ff;
}

.am-search-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  width: 16px;
  height: 16px;
}

/* Table */
.am-table-wrapper {
  overflow-x: auto;
  width: 100%;
}

.am-table {
  width: 100%;
  text-align: left;
  border-collapse: collapse;
}

.am-table th {
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 500;
  color: rgba(0,0,0,0.85);
  white-space: nowrap;
  background: #eceff1;
  border-bottom: 1px solid rgba(0,0,0,0.06);
}

.am-table td {
  padding: 16px;
  font-size: 14px;
  white-space: nowrap;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  transition: background-color 0.2s;
}

.am-table tr:hover td {
  background-color: #f5f5f5;
}

.am-table tr:hover .am-actions-hover {
  opacity: 1;
}

.am-td-date { font-weight: 500; color: #334155; }
.am-td-time { color: #475569; }
.am-td-break { color: #94a3b8; font-style: italic; }
.am-td-total { font-weight: 700; color: #1e293b; }

.am-status-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.am-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.am-status-text {
  font-size: 14px;
  text-transform: capitalize;
}

/* Actions */
.am-actions-hover {
  display: flex;
  align-items: center;
  gap: 12px;
  opacity: 0;
  transition: opacity 0.2s;
}

.am-action-btn {
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.am-action-btn.primary { color: #1890ff; }
.am-action-btn.primary:hover { text-decoration: underline; }
.am-action-btn.secondary { color: #94a3b8; }
.am-action-btn.secondary:hover { color: #475569; }

.am-divider {
  width: 1px;
  height: 12px;
  background: #e2e8f0;
}

/* States */
.am-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  gap: 16px;
}

.am-loading svg {
  animation: am-spin 1s linear infinite;
  color: #1890ff;
}

@keyframes am-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.am-empty {
  padding: 40px;
  text-align: center;
  color: #94a3b8;
  font-style: italic;
}

.am-offline-banner {
  background: #fff1f0;
  color: #f5222d;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border: 1px solid #ffa39e;
}
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/styles/AttendanceModule.css
git commit -m "style: add vanilla css for attendance module"
```

---

### Task 5: Implement UI Component
**Goal:** Translate the Tailwind component to Vanilla CSS and hook it up to real data. Note: The standalone navigation sidebar is intentionally omitted as requested.

**Files:**
- Create: `frontend/src/components/AttendanceModule.jsx`

- [ ] **Step 1: Write the Component**
Create `frontend/src/components/AttendanceModule.jsx`:

```jsx
import React, { useState, useMemo } from 'react';
import { Search, Calendar, Clock, CheckCircle2, AlertCircle, ArrowUpRight, Loader2, ListTodo } from 'lucide-react';
import { useAttendanceHistory } from '../hooks/useAttendanceHistory';
import '../styles/AttendanceModule.css';

const StatCard = ({ title, value, delta, icon: Icon, colorClass, isOffline }) => (
  <div className="am-stat-card">
    <div className="am-stat-header">
      <span className="am-stat-title">{title}</span>
      <div className="am-stat-icon-wrapper" style={{ backgroundColor: colorClass }}>
        <Icon />
      </div>
    </div>
    <div className="am-stat-value" style={{ color: isOffline ? '#cbd5e1' : undefined }}>
      {isOffline ? "--" : value}
    </div>
    <div className="am-stat-delta">{isOffline ? "N/A" : delta}</div>
  </div>
);

const getStatusColor = (status) => {
  const s = String(status).toLowerCase();
  if (['present', 'approved'].includes(s)) return '#52c41a';
  if (['absent', 'denied'].includes(s)) return '#f5222d';
  if (s === 'late') return '#faad14';
  if (s === 'pending') return '#1890ff';
  return '#cbd5e1';
};

export default function AttendanceModule() {
  const { data, loading, error } = useAttendanceHistory();
  const [searchQuery, setSearchQuery] = useState('');

  const stats = useMemo(() => {
    if (!data.length) return { hours: '0.00', present: 0, late: 0, ot: '0.00' };
    
    const totalHrs = data.reduce((acc, curr) => acc + parseFloat(curr.total_hours || 0), 0);
    const presentCount = data.filter(r => ['present', 'approved'].includes(r.status.toLowerCase())).length;
    const lateCount = data.filter(r => r.status.toLowerCase() === 'late').length;
    
    return {
      hours: totalHrs.toFixed(2),
      present: presentCount,
      late: lateCount,
      ot: '0.00' 
    };
  }, [data]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    return data.filter(r => 
      r.date?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.status?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery]);

  if (loading) {
    return (
      <div className="am-loading">
        <Loader2 size={40} />
        <p style={{ color: '#64748b', fontWeight: 500 }}>Syncing records...</p>
      </div>
    );
  }

  return (
    <div className="am-container">
      {error && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
           <div className="am-offline-banner">Offline: {error}</div>
        </div>
      )}

      <div className="am-stats-grid">
        <StatCard title="Total Hours" value={stats.hours} delta="Calculated from logs" icon={Clock} colorClass="#64748b" isOffline={!!error} />
        <StatCard title="Days Present" value={stats.present} delta="Count of active shifts" icon={CheckCircle2} colorClass="#52c41a" isOffline={!!error} />
        <StatCard title="Total Late" value={stats.late} delta="Requires attention" icon={AlertCircle} colorClass="#faad14" isOffline={!!error} />
        <StatCard title="Overtime" value={stats.ot} delta="Pending approval" icon={ArrowUpRight} colorClass="#1890ff" isOffline={!!error} />
      </div>

      <div className="am-content-panel">
        <div className="am-toolbar">
          <h2 className="am-toolbar-title">My Attendance Logs</h2>
          <div className="am-toolbar-actions">
            <button className="am-btn-outline" disabled={!!error}>
              <Calendar size={16} />
              <span>Filter Dates</span>
            </button>
            <div className="am-search-container">
              <input 
                type="text"
                disabled={!!error}
                placeholder="Search logs..."
                className="am-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <Search className="am-search-icon" />
            </div>
          </div>
        </div>

        <div className="am-table-wrapper">
          <table className="am-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Break In</th>
                <th>Break Out</th>
                <th>Total Hours</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '60px' }}>
                    <ListTodo size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                    <p style={{ color: '#475569', fontWeight: 'bold' }}>Server Connection Lost</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={8} className="am-empty">No records found.</td></tr>
              ) : filteredData.map((record, i) => (
                <tr key={i}>
                  <td className="am-td-date">{record.date}</td>
                  <td className="am-td-time">{record.time_in}</td>
                  <td className="am-td-time">{record.time_out}</td>
                  <td className="am-td-break">{record.break_in}</td>
                  <td className="am-td-break">{record.break_out}</td>
                  <td className="am-td-total">{record.total_hours}h</td>
                  <td>
                    <div className="am-status-cell">
                      <div className="am-status-dot" style={{ backgroundColor: getStatusColor(record.status) }} />
                      <span className="am-status-text">{record.status}</span>
                    </div>
                  </td>
                  <td>
                    <div className="am-actions-hover">
                      <button className="am-action-btn primary">Dispute</button>
                      <div className="am-divider" />
                      <button className="am-action-btn secondary">Details</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**
```bash
git add frontend/src/components/AttendanceModule.jsx
git commit -m "feat(ui): implement attendance module component"
```

---

### Task 6: Orchestrator Integration
**Goal:** Replace the placeholder in `EmployeeDashboard.jsx` with the new component.

**Files:**
- Modify: `frontend/src/pages/EmployeeDashboard.jsx`

- [ ] **Step 1: Mount Component**
Open `frontend/src/pages/EmployeeDashboard.jsx`. 
1. Add import: `import AttendanceModule from '../components/AttendanceModule';`
2. Locate the conditional rendering block for `activeNav === 'attendance'`. 
3. Replace the placeholder elements inside the `.content` div with `<AttendanceModule />`.

*(Self-Correction/Note for Executing Agent: The component should be rendered naked inside the main content area, without importing any sidebars from the prototype, relying instead on the EmployeeDashboard's native Sidebar via `DashboardSidebar`)*.

- [ ] **Step 2: Commit**
```bash
git add frontend/src/pages/EmployeeDashboard.jsx
git commit -m "feat: integrate new attendance module into employee dashboard"
```