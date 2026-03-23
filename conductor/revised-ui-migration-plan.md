# Revised UI Migration Roadmap: File-Centric Execution Plan

This plan breaks down the UI standardization and accessibility remediation into granular, file-specific tasks with discrete commit points.

## Phase 0: Foundations (Prerequisites)

### 0.1 Global Styles (`frontend/src/styles/app.css`)
- [ ] **Commit 1**: Add 4px-based spacing tokens and color primitives to `:root`.
- [ ] **Commit 2**: Refactor `.btn` base and variants (`primary`, `secondary`, `danger`) to use new tokens.
- [ ] **Commit 3**: Standardize `.card` and `.content` layout spacing.
- [ ] **Commit 4**: Add high-contrast button variants for confirmation modals.

### 0.2 Utilities (`frontend/src/utils/dateUtils.js`)
- [ ] **Commit 1**: Implement `formatFullDate` and `formatDateTime` functions.

---

## Phase 1: Component Standardization (File-by-File)

### 1.1 `FeedbackProvider.jsx`
- [ ] **Commit 1**: Enhance `confirm` signature to support `variant` (primary/danger).
- [ ] **Commit 2**: Update modal rendering to apply variant classes and improve ARIA accessibility.

### 1.2 `DataPanel.jsx` (Core Table Logic)
- [ ] **Commit 1**: Import and apply `dateUtils` for standardized date formatting in columns.
- [ ] **Commit 2**: Refactor action buttons to use Lucide Icons with `aria-label` support.
- [ ] **Commit 3**: Integrate `confirm` modal with variant support for "Deny/Approve" actions.
- [ ] **Commit 4**: Implement "Filed By", "Endorsed By", and "Approved By" column logic.

### 1.3 `AttendanceModule.jsx` (Functional Parity)
- [ ] **Commit 1**: Implement `SortableHeader` and sorting state logic.
- [ ] **Commit 2**: Replace placeholder toolbar with actual `from/to` date inputs and full-field search.
- [ ] **Commit 3**: Refactor layout to match the "Standardized Toolbar" pattern in `app.css`.

### 1.4 `FilingCenterPanel.jsx` (UX Consistency)
- [ ] **Commit 1**: Add persistent informational header showing Cluster/Coach context.
- [ ] **Commit 2**: Implement the "Agreement Checkbox" and submission blocking logic.

---

## Phase 2: Dashboard Integration

### 2.1 `CoachDashboard.jsx`
- [ ] **Commit 1**: Apply standardized date formatting to summary cards.
- [ ] **Commit 2**: Integrate `confirm` dialogs for sensitive actions (e.g., Disbanding Cluster).

### 2.2 `AdminDashboard.jsx`
- [ ] **Commit 1**: Apply state hoisting for attendance persistence (QA fix).
- [ ] **Commit 2**: Standardize summary metrics using the "Big Values" pattern.

---

## Phase 3: Verification
- [ ] **Commit 1**: Final responsive audit across `375px`, `768px`, and `1440px`.
- [ ] **Commit 2**: Accessibility audit (WCAG AA) for all interactive components.

---

### Execution Protocol for Agent
1.  Always **verify** the current state of a file before editing.
2.  Follow the **Commit-able Pieces** strictly: one commit per checkbox.
3.  Run `npm run lint` (if available) or manual syntax check after each commit.
4.  Update this checklist in `conductor/revised-ui-migration-plan.md` as work progresses.
