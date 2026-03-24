# Implementation Plan: Unified Toast Notifications for Attendance Module

## Objective
Find existing toast notifications in the codebase and integrate them into the Attendance Module and its related functionalities (Clock-In/Out, Request Filing, etc.) to ensure a unified UI and structure for user feedback.

## Key Files & Context
- **`frontend/src/components/FeedbackContext.js` & `FeedbackProvider.jsx`**: Existing global feedback system.
- **`frontend/src/pages/EmployeeDashboard.jsx`**: Handles Clock-In/Out for employees.
- **`frontend/src/pages/CoachDashboard.jsx`**: Handles Clock-In/Out for coaches and request management.
- **`frontend/src/components/FilingCenterPanel.jsx`**: Handles submission of leave, overtime, and dispute requests.
- **`frontend/src/components/AttendanceModule.jsx`**: Main display for attendance history.
- **`frontend/src/styles/app.css`**: Contains `.toast-*` styles.

## Proposed Solution
We will leverage the existing `useFeedback` hook to show standardized toasts for all attendance-related actions. To ensure "unified UI & structure", we will:
1.  Replace all local `message` states and inline error banners with `showToast` calls.
2.  Standardize the `title` and `type` for common actions (e.g., "Clock-In Success", "Submission Failed").
3.  Optionally create a specialized hook `useAttendanceFeedback` to centralize these standardized messages if needed, but direct use of `showToast` with consistent parameters is usually sufficient.

## Implementation Steps

### 1. Unified Structure Definition
Define standard parameters for attendance toasts:
- **Success Actions**: `type: "success"`, Title: `[Action] Successful`.
- **Error Actions**: `type: "error"`, Title: `[Action] Failed`.
- **Informational**: `type: "info"`, Title: `Note`.

### 2. Update `FilingCenterPanel.jsx`
- Import `useFeedback`.
- Destructure `showToast` from `useFeedback`.
- Remove local `message` state and `form-hint` div.
- In `handleSubmit`:
    - On success: `showToast({ title: "Request Submitted", message: "Your request has been filed successfully.", type: "success" })`.
    - On error: `showToast({ title: "Submission Failed", message: error.error, type: "error" })`.

### 3. Update `EmployeeDashboard.jsx` & `CoachDashboard.jsx`
- Import `useFeedback` (CoachDashboard already imports it but only uses `confirm`).
- Update `persistAttendance` (or equivalent clocking functions):
    - Add `showToast` for Clock-In success (e.g., "Clocked In Successfully").
    - Add `showToast` for Clock-Out success (e.g., "Clocked Out Successfully").
    - Add `showToast` for errors (e.g., "Clock-In Failed").

### 4. Update `AttendanceModule.jsx`
- Import `useFeedback`.
- Replace `am-offline-banner` with a toast if an error occurs during history fetching.
- *Note*: Since `AttendanceModule` is often a sub-component, we should be careful not to trigger duplicate toasts if the parent already handles it.

### 5. UI Standardization Check
- Review `.toast-card` in `app.css` to ensure it aligns with the Attendance Module's clean, modern aesthetic.
- (Optional) Add icons to the toast titles if the `FeedbackProvider` doesn't already support them (it currently uses CSS-based styling for types).

## Verification & Testing
- **Clock-In/Out**: Verify toast appears with correct type and message after each action.
- **Filing Center**: Submit Leave, OT, and Dispute requests. Ensure success toasts show up and form resets correctly.
- **Error Handling**: Simulate a network failure or validation error (e.g., missing photo) and verify error toast appears.
- **Dismissal**: Ensure toasts auto-dismiss after the duration (3200ms default) or when the close button is clicked.
