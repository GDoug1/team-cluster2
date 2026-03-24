# Unified Table Structure & UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the table structures and UI for "My Attendance", "My Requests", "File Request", and "All Attendance" tabs, standardizing the "Actions" column and ensuring visual consistency across all dashboards while strictly adhering to `docs/design/STANDARDS.md`.

**Architecture:** Create a shared `UnifiedTable` component in `frontend/src/components/shared/` that leverages CSS Grid for flexible column management and provides a standardized layout for filters, sorting, and pagination.

**Tech Stack:** React, Lucide React (Icons), CSS Grid.

---

### Task 1: Create `UnifiedTable` Component

**Files:**
- Create: `frontend/src/components/shared/UnifiedTable.jsx`
- Create: `frontend/src/components/shared/UnifiedTable.css`

- [ ] **Step 1: Implement `UnifiedTable.jsx`**
  Create a generic table component that supports:
  - Configurable columns with CSS Grid widths.
  - Standardized sorting headers.
  - Integrated filters (Search, Date Range, Optional Selects).
  - Pagination summary and actions.
  - A dedicated "Actions" column slot (Text-only buttons as per standards).
  - Expandable cell support for text-heavy columns.

```jsx
import React, { useState } from 'react';
import { Search, ChevronUp, ChevronDown, ArrowUpDown, Loader2 } from 'lucide-react';
import './UnifiedTable.css';

const SortableHeader = ({ label, sortKey, currentSortKey, direction, onSort }) => {
  const isActive = currentSortKey === sortKey;
  return (
    <button
      type="button"
      className={`am-sort-btn ${isActive ? "is-active" : ""}`}
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      <span className="am-sort-icon">
        {!isActive ? <ArrowUpDown size={14} /> : direction === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </span>
    </button>
  );
};

export default function UnifiedTable({
  columns = [], // { label, key, sortKey, sortable, expandable }
  data = [],
  loading = false,
  error = null,
  // Pagination
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  rowsPerPage = '10',
  onRowsPerPageChange,
  // Filtering
  searchQuery = '',
  onSearchChange,
  dateStart = '',
  onDateStartChange,
  dateEnd = '',
  onDateEndChange,
  onClearFilters,
  extraFilters = null,
  // Sorting
  sortKey,
  sortDirection,
  onSort,
  // Row Rendering
  renderCell, // (item, columnKey) => ReactNode
  renderActions, // (item) => ReactNode
  emptyMessage = "No records found.",
  gridTemplateColumns,
}) {
  const visibleStart = data.length === 0 ? 0 : (currentPage - 1) * parseInt(rowsPerPage) + 1;
  const visibleEnd = Math.min(currentPage * parseInt(rowsPerPage), (currentPage - 1) * parseInt(rowsPerPage) + data.length);

  return (
    <div className="am-content-panel">
      <div className="am-toolbar">
        <div className="am-toolbar-actions">
          <div className="am-filter-group">
            <label className="am-filter-field">
              <span className="am-filter-label">From</span>
              <input type="date" value={dateStart} onChange={e => onDateStartChange(e.target.value)} />
            </label>
            <label className="am-filter-field">
              <span className="am-filter-label">To</span>
              <input type="date" value={dateEnd} onChange={e => onDateEndChange(e.target.value)} />
            </label>
            {extraFilters}
          </div>
          <div className="am-search-container">
            <input 
              type="text"
              placeholder="Search..."
              className="am-search-input"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            <Search className="am-search-icon" />
          </div>
          <label className="am-rows-field">
            <span className="am-rows-label">Rows</span>
            <input
              type="text"
              inputMode="numeric"
              className="am-rows-input"
              value={rowsPerPage}
              onChange={e => onRowsPerPageChange(e.target.value)}
            />
          </label>
          <button className="am-btn-secondary" type="button" onClick={onClearFilters}>
            Clear
          </button>
        </div>
      </div>

      <div className="am-table-wrapper">
        <div className="am-table-header" role="row" style={{ gridTemplateColumns }}>
          {columns.map(col => (
            <span key={col.key} role="columnheader">
              {col.sortable ? (
                <SortableHeader 
                  label={col.label} 
                  sortKey={col.sortKey || col.key} 
                  currentSortKey={sortKey} 
                  direction={sortDirection} 
                  onSort={onSort} 
                />
              ) : (
                col.label
              )}
            </span>
          ))}
          <span role="columnheader">Actions</span>
        </div>

        <div className="am-table-body">
          {loading ? (
            <div className="am-loading">
              <Loader2 size={32} />
              <p>Syncing records...</p>
            </div>
          ) : error ? (
            <div className="am-error-state">
               <p>{error}</p>
            </div>
          ) : data.length === 0 ? (
            <div className="am-empty">{emptyMessage}</div>
          ) : data.map((item, i) => (
            <div className="am-table-row" key={item.id || i} role="row" style={{ gridTemplateColumns }}>
              {columns.map(col => (
                <span 
                  key={col.key} 
                  role="cell" 
                  className={col.expandable ? "am-table-cell-expandable" : ""}
                  style={{ minWidth: 0 }}
                >
                  {renderCell ? renderCell(item, col.key) : item[col.key]}
                </span>
              ))}
              <span role="cell" className="am-table-actions-cell">
                {renderActions && renderActions(item)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="am-table-pagination">
        <div className="am-pagination-summary">
          Showing {visibleStart}-{visibleEnd} of records
        </div>
        <div className="am-pagination-actions">
          <button className="am-pagination-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
            Previous
          </button>
          <span className="am-pagination-info">Page {currentPage} of {totalPages}</span>
          <button className="am-pagination-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement `UnifiedTable.css`**
  Follow `docs/design/STANDARDS.md` for expandable cells and action buttons.

```css
/* frontend/src/components/shared/UnifiedTable.css */

.am-table-header {
  display: grid;
  padding: 12px 16px;
  background: #eceff1;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  font-weight: 500;
  color: rgba(0,0,0,0.85);
  font-size: 14px;
  align-items: center;
}

.am-table-row {
  display: grid;
  padding: 16px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  align-items: center;
  transition: background-color 0.2s;
}

.am-table-row:hover {
  background-color: #f5f5f5;
}

.am-table-actions-cell {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* STANDARDS.md: No icons alone, use text labels */
.am-table-actions-cell .btn,
.am-table-actions-cell .am-action-btn {
  font-size: 13px;
  font-weight: 600;
  text-transform: capitalize;
}

/* STANDARDS.md: Expandable cell pattern */
.am-table-cell-expandable {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
  transition: all 0.2s ease-in-out;
}

.am-table-cell-expandable:hover,
.am-table-cell-expandable:focus-within {
  white-space: normal;
  overflow: visible;
  height: auto;
  padding: 12px 16px;
  line-height: 1.5;
  overflow-wrap: break-word;
  word-break: break-word;
  background: #fff;
  z-index: 10;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  border-radius: 4px;
}

/* Pagination & Toolbar */
.am-pagination-btn {
  padding: 6px 12px;
  border: 1px solid #d9d9d9;
  background: #fff;
  border-radius: 2px;
  font-size: 13px;
  cursor: pointer;
}

.am-pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.am-pagination-info {
  font-size: 13px;
  color: #64748b;
}
```

- [ ] **Step 3: Commit `UnifiedTable`**
  ```bash
  git add frontend/src/components/shared/UnifiedTable.jsx frontend/src/components/shared/UnifiedTable.css
  git commit -m "feat: implement UnifiedTable component following project standards"
  ```

---

### Task 2: Refactor `AttendanceModule` (My Attendance)

**Files:**
- Modify: `frontend/src/components/AttendanceModule.jsx`

- [ ] **Step 1: Replace custom table logic with `UnifiedTable`**
  - Use text-only "Dispute" button in the Actions column.
  - Standardize grid widths using `gridTemplateColumns`.

- [ ] **Step 2: Commit refactor**
  ```bash
  git add frontend/src/components/AttendanceModule.jsx
  git commit -m "refactor: update My Attendance view with UnifiedTable"
  ```

---

### Task 3: Refactor `DataPanel` (Requests & All Attendance)

**Files:**
- Modify: `frontend/src/components/DataPanel.jsx`

- [ ] **Step 1: Consolidate 'View Photo' into 'View' modal**
  Remove separate "View Photo" button from table rows. The "View" details modal must display the photo if it exists.

- [ ] **Step 2: Update 'Requests' implementation**
  - Use text-only labels for "Accept", "Reject", "View".
  - Move all actions into the dedicated "Actions" column.

- [ ] **Step 3: Update 'All Attendance' implementation**
  - Use text-only "Edit" button.

- [ ] **Step 4: Commit refactor**
  ```bash
  git add frontend/src/components/DataPanel.jsx
  git commit -m "refactor: update All Attendance and Requests views with UnifiedTable"
  ```

---

### Task 4: Final Verification & Polish

- [ ] **Step 1: Check across all roles**
  Verify that Admin, Coach, and Employee dashboards all show consistent table UI.
- [ ] **Step 2: Verify accessibility**
  Ensure text-only buttons have proper aria-labels if needed, and grid navigation works.
- [ ] **Step 3: Final Sync**
  Ensure all `am-` classes are applied and no styles are leaking or conflicting.
- [ ] **Step 4: Final Commit**
  ```bash
  git add .
  git commit -m "chore: complete unified table UI migration"
  ```
