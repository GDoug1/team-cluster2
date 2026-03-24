# UI/UX Standardization Plan

## Objective
Harmonize the application's UI/UX by adopting the refined patterns found in the **Attendance Module** and **Employee Management** sections. This plan ensures a consistent "look and feel" while providing specialized layouts for varying functional needs (logs, CRUD management, and form-heavy filing).

---

## 🎨 1. Design Foundations (CSS Tokens)
Ensure all modules consume the standardized variables from `app.css` to maintain theme consistency.

- **Surface Tokens:** 
  - `--surface`: `#ffffff` (Main cards)
  - `--surface-muted`: `#f8fafc` (Backgrounds/Secondary cards)
- **Accent Tokens:**
  - `--accent`: `#3b82f6` (Primary buttons/links)
  - `--accent-soft`: `#dbeafe` (Subtle highlights)
- **Typography:**
  - Font: `Inter`
  - Weight Hierarchy: `500` (Medium labels), `700` (Bold titles), `800` (Big metrics).

---

## 🏛 2. Layout & Shell Architecture
Standardize the "Dashboard Orchestrator" pattern used in `CoachDashboard.jsx` and `EmployeeDashboard.jsx`.

- **Sidebar Integration:** Use `DashboardSidebar` with dynamic `navItems` derived from `usePermissions`.
- **Main Container:** 
  ```jsx
  <main className="main">
    <section className="content">
      {/* Module Content */}
    </section>
  </main>
  ```
- **Module Orchestration:** Use an `activeNav` state to swap between specialized panels (e.g., `AttendanceModule`, `EmployeesSection`, `FilingCenterPanel`).

---

## 🧱 3. Standardized Component Patterns

### A. The "Stats Summary" Pattern
For any page providing an overview (Attendance, Team Management, Control Panel).
- **Component:** `am-stats-grid` (CSS) + `StatCard` (JSX).
- **Logic:** 4-column grid (responsive to 1 or 2 on mobile) showing key counts or totals.

### B. The "Toolbar & Action" Pattern
Standardize the control bar above lists and tables.
- **Component:** `am-toolbar` (CSS).
- **Elements:**
  - **Search:** `am-search-container` with absolute-positioned icon.
  - **Filters:** Grouped date/type pickers (`am-filter-group`).
  - **Bulk Actions:** Standard `btn primary` or `btn-action-soft`.

### C. The "Data Grid" Pattern (Tables)
Adopt the sortable table pattern from `AttendanceModule.jsx`.
- **Header:** `SortableHeader` component with `ArrowUpDown` / `Chevron` icons.
- **Dynamic Cell Scaling & Expansion:** 
  - **Rest State (Default):** Use `white-space: nowrap`, `overflow: hidden`, and `text-overflow: ellipsis` for long content (like Notes or Details) to maintain uniform row heights in dense tables.
  - **Active State (Expansion):** On `:hover` (or `:focus-within`), transition to `white-space: normal`, `overflow: visible`, and `height: auto` to reveal full content.
  - **Spacing Hygiene:** Maintain internal padding (`padding: 12px 16px`) and `line-height: 1.5` during expansion to ensure readability and prevent text from touching cell borders.
  - **Container Integrity (No Clipping):** Strictly enforce that no content clips or overflows outside its respective container. 
    - Use `overflow-wrap: break-word` and `word-break: break-word` within the expanded state.
    - Ensure `min-width: 0` is applied to flex/grid items to allow proper truncation and prevent horizontal container "blowout".
- **Row Interactivity & Actions:** 
  - Background change on hover (`#f5f5f5`).
  - **Actions Grouping:** All row-level actions must be consolidated within a dedicated **"Actions"** column cell to prevent UI clutter and maintain a predictable interaction point.

### E. The "Action-First" Button Pattern (Standardized Labels & Layout)
Ensure all interactive elements, particularly within tables, prioritize immediate clarity through text and consistent grouping.

- **Labeling (Action-First):** Use **singular action verbs** (e.g., "Save", "Edit", "View", "Delete", "Create", "Approve", "Deny").
  - *Refinement:* Avoid multi-word labels (e.g., "Add Member" -> "Add", "Edit Details" -> "Edit") and **NEVER** use icons alone for row actions.
- **Grouping:** All row-level actions must be consolidated within a dedicated **"Actions"** column cell.
- **De-duplication:** Remove redundant secondary action buttons. 
  - *Example:* In the Attendance/Requests logs, the "View Photo" button is removed. Supporting photos must be accessed directly through the primary "View" details modal.

---

## 🔄 4. Functional Variation Handling (Attendance Focus)

| Feature Type | UX Strategy | Reference Component |
| :--- | :--- | :--- |
| **Attendance Logs** | Read-only rows with a "Dispute" text button in the Actions column. | `AttendanceModule.jsx` |
| **Request Management** | Rows with "View", "Approve", and "Reject" text buttons grouped in the Actions column. | `DataPanel.jsx` |
| **Request Filing** | Step-by-step or tabbed forms in a centered panel with singular "Submit" action. | `FilingCenterPanel.jsx` |
| **Dashboard Overviews** | Large numbers and visual "Big Values" for metrics. | `MainDashboard.jsx` |

---

## 🔔 5. Global Feedback & Interaction
Mandate the use of the `FeedbackProvider` for all user-initiated mutations.

- **Toasts:** Use for non-critical confirmations (e.g., "Schedule Saved").
- **Confirm Dialogs:** Use for destructive or multi-step actions (e.g., "Disband Cluster").
- **Loading States:** Use `Loader2` from `lucide-react` with the `am-loading` overlay pattern.

---

## 🛠 Verification & Testing
1. **Responsive Audit:** Verify all standardized tables/grids at `375px`, `768px`, and `1440px`.
2. **Accessibility (WCAG AA):**
   - Ensure `aria-live="polite"` on the `toast-stack`.
   - Verify `role="table"` and `role="row"` on all grid components.
   - Maintain 4.5:1 contrast on all text elements.
3. **Consistency Check:** Cross-reference new pages against `AttendanceModule` to ensure no design drift.
