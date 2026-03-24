# UI/UX Technical Standards Reference

This document defines the mandatory patterns and constraints for all UI/UX development in the Team Cluster 2 project, specifically for the **Attendance** and **Management** modules.

---

## 🏗 1. Naming & Structure
- **Prefixing:** All attendance-related layout and component classes must use the `am-` prefix (e.g., `.am-table-row`, `.am-toolbar`).
- **Layout Shell:** Use the standardized dashboard structure:
  ```jsx
  <main className="main">
    <section className="content">
      {/* Component content here */}
    </section>
  </main>
  ```

---

## 🖱 2. Action Button Standards
- **Text-Only Labels:** Row actions in tables MUST NOT use icons alone. Use clear text labels.
- **Label Dictionary:** Use singular action verbs:
  - `View` (Details/Photo)
  - `Edit` (CRUD)
  - `Delete` / `Archive` (Destructive)
  - `Approve` / `Endorse` (Acceptance)
  - `Reject` / `Deny` (Rejection)
  - `Dispute` (Attendance)
- **Grouping:** All row actions must be consolidated into a single **"Actions"** column cell.
- **De-duplication:** 
  - **NO** "View Photo" buttons in tables. 
  - All supporting media must be accessed through the primary **"View"** details modal.

---

## 📊 3. Unified Highlight System (Summaries & Filtering)
Found in `src/components/shared/HighlightCard.jsx` and `src/components/AttendanceHistoryHighlights.jsx`.

### **Visual Consistency**
- **Lucide Icons:** All cards MUST use Lucide icons for visual representation.
- **Accent Classes:** Use standardized accent classes for theme colors:
  - `.is-slate`: General metrics (Total Hours, Total Requests).
  - `.is-green`: Positive metrics (Present, Approved).
  - `.is-amber`: Caution metrics (Late, Pending).
  - `.is-red`: Negative metrics (Rejected).
  - `.is-blue`: Information metrics (Overtime, Timed In).

### **Interactive Filtering**
- **Pattern:** Highlight cards MUST serve as interactive filters for the sibling data table.
- **Visual Feedback:** The active filter MUST be visually distinct (using the `isActive` prop).
- **Toggle Behavior:** Clicking an active card again MUST clear the filter.

---

## 📊 4. Data Grid Pattern (Tables)
### Dynamic Cell Scaling & Expansion
To maintain high density without losing data visibility, use the following CSS pattern:

#### **Rest State (Default)**
```css
.am-table-cell-expandable {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0; /* Prevents container blowout */
  transition: all 0.2s ease-in-out;
}
```

#### **Active State (Hover/Focus)**
```css
.am-table-cell-expandable:hover,
.am-table-cell-expandable:focus-within {
  white-space: normal;
  overflow: visible;
  height: auto;
  padding: 12px 16px; /* Spacing Hygiene */
  line-height: 1.5;    /* Spacing Hygiene */
  overflow-wrap: break-word;
  word-break: break-word;
}
```

### **No Clipping & Container Integrity**
- **Rule:** Content must NEVER clip or overflow outside its respective cell container.
- **Implementation:** Always use `min-width: 0` on flex/grid children that contain text to ensure truncation logic (ellipsis) triggers correctly instead of pushing the container width.

---

## 🎨 4. Design Tokens (Quick Ref)
Access these variables from `app.css`:
- **Spacing:** `var(--space-1)` (4px) to `var(--space-8)` (32px).
- **Radius:** `var(--radius-md)` (8px), `var(--radius-lg)` (12px).
- **Padding:** Standard content padding is `var(--space-6) var(--space-8)`.

---

## 🛠 5. Verification Checklist
Before completing a UI task, verify:
- [ ] No action icons in table rows.
- [ ] All buttons use singular verbs.
- [ ] No "View Photo" button (consolidated into "View").
- [ ] Cells expand on hover without clipping or breaking the layout.
- [ ] `min-width: 0` is present on text-heavy grid cells.
