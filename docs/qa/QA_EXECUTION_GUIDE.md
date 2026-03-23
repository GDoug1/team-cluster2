# Attendance & Request Module: QA Execution Guide

This document provides step-by-step instructions for performing Quality Assurance on the Team Cluster 2 Attendance and Request modules. It maps directly to the 36 test cases defined in the project's traceability matrix.

---

## 🛠️ 1. Environment Setup

*   **Frontend:** `http://localhost:5173` (Ensure `npm run dev` is running in `/frontend`).
*   **Backend:** Apache & MySQL active in XAMPP.
*   **Database:** `system_hris_db` (Latest schema with `photo_path` support).

---

## 🔑 2. QA Test Accounts
**Default Password:** `QA_Pass123!`

| Role | Email | Primary Testing Focus |
| :--- | :--- | :--- |
| **Super Admin** | `qa_superadmin@mail.com` | Permissions, User Logs, Control Panel. |
| **Admin** | `qa_admin@mail.com` | System-wide Request Management & Global History. |
| **Team Coach** | `qa_coach@mail.com` | Cluster Attendance, Team Requests & Approvals. |
| **Employee** | `qa_employee@mail.com` | Time Logs, Filing Disputes/OT/Leave, Personal History. |

---

## 🧪 3. Detailed Test Case Execution

### A. Attendance Persistence & Logic
*Objective: Verify that time logs remain accurate during navigation and session changes.*

| Case ID | Scenario | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **8, 13** | **Nav Persistence** | Login as **Employee**. Click "Time In". Navigate to "Filing Center" and "Dashboard". | Timer continues running without resetting to "Time In" state. |
| **14** | **Refresh Recovery** | While "Timed In", press **F5** or refresh the browser. | The active timer restores automatically upon page load. |
| **15** | **Stats Accuracy** | Observe "Total Hours" on the Dashboard while timed in. | Hours increment in real-time (HH:MM:SS format). |
| **20** | **Late Tagging** | Set PC time to **9:16 AM** (or 16 mins after shift start). Perform "Time In". | System automatically tags the log as **"Late"**. |
| **22** | **Overlapping Logs**| Attempt to "Time In" while already in an active session. | System prevents duplicate active logs for the same day. |

### B. Admin & Coach Request Management
*Objective: Verify the workflow for approving, rejecting, and viewing requests.*

| Case ID | Scenario | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **1, 4, 23** | **Table Integrity** | Login as **Admin**. Open "Team Requests". | "Request Type", "Employee Name", and "Submitted Date" are clearly visible. |
| **7, 31** | **Status Updates** | Find a "Pending" request. Click **Endorse** or **Reject**. | Status updates immediately in the UI (e.g., to "Endorsed" or "Denied"). |
| **12, 21** | **CORS/API Check** | Login as **Coach**. Open "Team Requests". Press **F12** for Console. | No red "CORS Policy" or "Access-Control-Allow-Origin" errors appear. |
| **27** | **Action Icons** | View the "Actions" column in any Request table. | Buttons are replaced with clean icons (Checkmark/X) on the right side. |
| **34** | **Status Links** | Click on a "Denied" or "Approved" status badge. | A modal/tooltip shows *who* performed the action. |

### C. Filing Center & Compliance
*Objective: Verify that employees can file requests accurately with required proof.*

| Case ID | Scenario | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **11, 19, 29**| **Policy Agreement**| Open "Leave Request". Fill details but **do not** check the agreement box. | "Submit" button remains disabled or triggers a validation block. |
| **30** | **Photo Evidence** | Create a Leave Request. Use the "Upload Proof" field to attach an image. | File uploads successfully and is saved in `backend/uploads/leave-photos/`. |
| **33** | **Date Lock** | Open "Overtime Request". Try to select a date in the past. | Past dates are restricted/unselectable in the date picker. |
| **18** | **Auto-Detect** | Login as **Employee**. Open "Dispute Form". | "Cluster" and "Coach" fields are pre-filled based on your account settings. |
| **28** | **Details Window** | Click "View Details" on an existing request in "My Requests". | A small modal opens showing the full reason and content of the filing. |

### D. Global UI & Formatting
*Objective: Ensure consistent visual standards across the application.*

| Case ID | Scenario | Execution Steps | Expected Result |
| :--- | :--- | :--- | :--- |
| **2, 26** | **Date Formatting** | View any list of logs or requests. | Dates use full month names (e.g., "March 23, 2026" instead of "03/23/26"). |
| **25, 36** | **Confirmations** | Click "Time Out" or "Cancel Request". | A pop-up modal appears asking for confirmation before the action executes. |
| **35** | **Pagination** | Go to a table with many records (e.g., Attendance History). | User can toggle between 20, 50, and 100 records per page. |
| **6** | **Dashboard Stats** | Compare "Total Presents" on Dashboard vs the Attendance History list. | Totals match the number of active records for the current period. |

---

## 🧪 4. New Features: Accessibility & UI Remediation Verification
*Objective: Verify specific remediations for standardized formatting and accessibility.*

### 1. Centralized Date Formatting
*   **Target:** `DataPanel`, `CoachDashboard`, `AdminDashboard`.
*   **Execution:** View any list of requests or attendance logs.
*   **Verification:** Ensure the format strictly follows: **"Mon, March 23, 2026"** (Short Day, Full Month, Numeric Day, Full Year).
*   **Success Criteria:** No numeric-only dates (e.g., 03/23/2026) or short month abbreviations (e.g., Mar) should appear in core lists.

### 2. High-Contrast Modal Variants
*   **Execution (Primary):** Click "Time Out" or "Approve".
*   **Verification:** Confirm the confirmation button is **Dark Blue (#357AF4)** with white text.
*   **Execution (Danger):** Click "Reject" or "Cancel Request".
*   **Verification:** Confirm the confirmation button is **Dark Red (#D93025)** with white text.
*   **Success Criteria:** Text must be clearly readable. Buttons must have a visible border and hover effect.

### 3. Screen Reader & Icon Refinement
*   **Execution:** Use "Inspect Element" (F12) or a screen reader (NVDA/VoiceOver) on the Approve/Reject icons in `DataPanel`.
*   **Verification:**
    *   Check that the `<button>` has a descriptive `aria-label` (e.g., `"Approve for Jaden Rivera"`).
    *   Check that the nested `<svg>` icon has `aria-hidden="true"`.
*   **Success Criteria:** Screen readers should announce the action and context, not just "button".

### 4. Mandatory Action Confirmation
*   **Execution:** Attempt to "Time Out" from the Dashboard or "Reject" a request from the table.
*   **Verification:** A confirmation modal MUST appear before the action is executed.
*   **Success Criteria:** It should be impossible to perform these actions with a single accidental click.

---

## 🔐 5. Security & RBAC Verification
*Objective: Ensure that unauthorized users cannot access administrative tools or data.*

### 1. Control Panel Isolation
*   **Target:** `EmployeeDashboard`, `CoachDashboard`.
*   **Execution:** Login as **Employee** (`qa_employee@mail.com`).
*   **Verification:** Confirm that "Control Panel" is NOT visible in the sidebar and that navigating manually to `/employee` (while activeNav is "Control Panel") does not show the section.
*   **Success Criteria:** Administrative tools must be completely hidden from non-admin roles.

### 2. Employee List Protection
*   **Execution:** Login as **Employee** or **Coach**.
*   **Verification:** Confirm that the "Employees" tab/section is either hidden or shows an "Access Denied" state if permissions are missing.
*   **Success Criteria:** Standard employees must not be able to view the full list of other employees.

---

## 🚩 6. Bug Reporting Protocol

If a test case fails (Status: **Need Revisions**):
1.  **Capture Console Logs:** Press **F12**, go to **Console**, and take a screenshot of any red errors.
2.  **Document Steps:** Record if the error happens only on a specific browser (Chrome vs. Edge).
3.  **Update Matrix:** Update the `STATUS` column in `docs/qa/ATTENDANCE_TEST_CASES.md`.

---
*Updated: March 23, 2026*
