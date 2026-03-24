# Plan: Revise "My Attendance" Table (AttendanceModule.jsx)

Upgrade `AttendanceModule.jsx` to be as functional and aesthetically consistent as the `DataPanel.jsx` component.

## Objective
The goal is to modify the "My Attendance Logs" table in `AttendanceModule.jsx` to include:
-   **Full Sorting**: Add sortable headers for Date, Time In, Time Out, Total Hours, and Status.
-   **Advanced Search**: Expand search to cover all table fields.
-   **Functional Date Range Filter**: Replace the placeholder button with actual `from` and `to` date inputs.
-   **Consistent UI**: Align the styling, iconography, and interactions with the standard application patterns.

## Key Files & Context
-   `frontend/src/components/AttendanceModule.jsx`: The component responsible for the employee's attendance history view.
-   `frontend/src/styles/AttendanceModule.css`: Styles for the attendance module.
-   `frontend/src/components/DataPanel.jsx`: The reference component for "functional" tables.

## Implementation Steps

### 1. Update `AttendanceModule.jsx`
-   **Add Sort State**: Introduce `sortKey` and `sortDirection` states.
-   **Implement `SortableHeader`**: Create or import a `SortableHeader` component.
-   **Implement Full Search & Date Range Filtering**:
    -   Add `dateStartFilter` and `dateEndFilter` states.
    -   Update the filtering logic in `useMemo` to include date range and multi-field search.
-   **Implement Sorting Logic**: Add a `handleSort` function and update the `filteredData` `useMemo`.
-   **UI Refinement & Action Standardization**:
    -   Replace the `am-toolbar-actions` placeholder with standard date and search inputs.
    -   **Action Column**: Ensure all row-level buttons are grouped in a single "Actions" column.
    -   **Text-Only Actions**: Replace any action icons with singular action verbs (e.g., "Dispute").
    -   **De-duplicate Functions**: If any row includes a "View Photo" button, remove it and ensure the photo is accessible via the "View" details modal.
-   **Dynamic Cell Scaling**:
    -   **Rest State**: Implement `white-space: nowrap`, `overflow: hidden`, and `text-overflow: ellipsis` for content like "Note" or "Details" to maintain a dense, uniform table layout.
    -   **Expansion (Hover/Focus)**: Apply `white-space: normal` and `height: auto` on hover/focus to reveal full content dynamically.
    -   **Spacing Hygiene**: Ensure that expanded cells maintain a minimum internal padding (approx. `12px-16px`) and a `1.5` line-height for optimal readability.
    -   **Container Integrity (No Clipping)**: Strictly enforce that no content clips or overflows outside its respective container.
        - Use `overflow-wrap: break-word` and `word-break: break-word` within the expanded state.
        - Ensure `min-width: 0` is applied to flex/grid items to allow proper truncation and prevent horizontal container blowout.

### 2. Update `DataPanel.jsx` (Requests View)
Since `DataPanel.jsx` is used for Attendance Requests across dashboards, apply consistent action patterns:
-   **Actions Column**: Consolidate "View", "Approve", and "Reject" into the Actions column.
-   **Icon-to-Text Migration**: Replace `CheckCircle2` and `XCircle` with "Approve" (or "Endorse") and "Reject" text labels.
-   **Remove "View Photo"**: Ensure photos are viewed via the "View" button modal only.
-   **Update Grid Layout**: Adjust `requestGridStyle` and `attendanceGridStyle` to accommodate wider text buttons in the Actions column.

### 2. Update `AttendanceModule.css` (if needed)
-   Ensure the new sorting icons and date inputs are correctly styled and responsive.

## Verification & Testing
1.  **Manual Verification**:
    -   Log in as an **Employee**.
    -   Go to "My Attendance".
    -   Verify that clicking on table headers (Date, Time In, etc.) sorts the records correctly in both ascending and descending order.
    -   Enter a date range in the "From" and "To" fields and verify that the table only shows records within that range.
    -   Type a status (e.g., "Late") or a partial date in the search bar and verify that it filters correctly.
    -   Change the "Rows per page" and verify that pagination updates as expected.
    -   Verify that the "Dispute" button still works correctly for individual rows.
