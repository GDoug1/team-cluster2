# Attendance Module - New QA Test Cases

This document outlines new test cases for the Attendance module based on recent QA findings (March 17, 2026). These cases focus on persistence, data visibility, and functional logic for Employees, Coaches, and Admins.

## Test Case Table

| ID | FEATURE | SCENARIO | TEST STEPS | EXPECTED RESULTS | STATUS | TEST DATE | TESTER NAME |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ALL** | Attendance | Persistence: Cross-Tab Navigation | 1. Log in to dashboard.<br>2. Click "Time In".<br>3. Navigate to a different page (e.g., Requests).<br>4. Return to "Dashboard". | Time In status and counter should remain active and consistent without resetting. | Pending | 3/17/2026 | |
| **ALL** | Attendance | Persistence: Session Recovery | 1. Perform "Time In".<br>2. Refresh the browser (F5).<br>3. Wait for dashboard to load. | The system should re-fetch active attendance from the API and restore the counter. | Pending | 3/17/2026 | |
| **ALL** | Attendance | Dashboard Stats Accuracy | 1. Observe "Total Hours" on Dashboard while Timed In.<br>2. Wait for 10 minutes. | Total hours should increment accurately in real-time (e.g., from 0.0h to 0.2h). | Pending | 3/17/2026 | |
| **COACH** | Attendance | Team Member Visibility | 1. Log in as Coach.<br>2. Navigate to "Team Cluster Attendance". | All active cluster members should be listed with their latest Time In/Out logs for the selected date. | Pending | 3/17/2026 | |
| **COACH** | Attendance | Dynamic Member Status | 1. Access Coach Dashboard.<br>2. View "Member Status" card. | Card should display real-time updates of active members (e.g., "Kim Santos - Requesting OT") instead of placeholder data. | Pending | 3/17/2026 | |
| **EMPLOYEE** | Filing Center | Auto-detect Coach/Cluster | 1. Go to "My Filing Center".<br>2. Open a "Dispute" or "OT" form. | The "Coach" and "Cluster" fields should be pre-filled based on the employee's current assignment. | Pending | 3/17/2026 | |
| **ALL** | Request | Agreement Confirmation | 1. Fill out a request form.<br>2. Attempt to submit without checking "Agreement". | Submission should be blocked with a validation message until the agreement is confirmed. | Pending | 3/17/2026 | |
| **EMPLOYEE** | ATTENDANCE | Late Tag Calculation | 1. Set schedule to 9:00 AM.<br>2. Perform "Time In" at 9:16 AM. | Attendance status should automatically be tagged as "Late" (exceeding 15-min grace period). | Pending | 3/17/2026 | |
| **COACH** | Team Request | CORS Policy Check | 1. Log in as Coach.<br>2. Navigate to "Team Request". | Request table should load data from the backend without "CORS policy" errors in the console. | Pending | 3/17/2026 | |
| **EMPLOYEE** | ATTENDANCE | Constraint: Overlapping Logs | 1. Perform "Time In".<br>2. Try to trigger "Time In" again (e.g., via API or UI glitch). | System should prevent duplicate active logs for the same employee/cluster on the same day. | Pending | 3/17/2026 | |

## Revision Notes for Developers

- **Persistence Fix:** The `useEffect` in dashboard components must verify that the `attendanceLog` state is properly synced with the backend data on every mount.
- **Member Status Logic:** `MainDashboard.jsx`'s `MemberStatusCard` currently uses static text. This must be mapped to the `activeMembers` data from the Coach/Admin views.
- **CORS Handling:** Ensure `backend/api/cors.php` is included in all request-related PHP scripts to resolve the CORS policy issues reported in QA.
