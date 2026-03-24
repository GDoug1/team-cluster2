# Unified Highlight Cards & Interactive Filtering

This document outlines the strategy for unifying the summary highlight cards across the system and introducing interactive "Click-to-Filter" functionality.

## 🎯 Objectives
- **Visual Unity:** Standardize the UI of highlight cards across "My Attendance", "My Requests", "File Request", and "All Attendance".
- **Structural Consistency:** Use a single shared `HighlightCard` component instead of disparate local implementations.
- **Interactivity:** Enable users to filter tables by clicking on the corresponding highlight card (e.g., clicking "Pending" filters the table to show only pending requests).
- **Maintainability:** Centralize highlight construction logic into reusable utilities.

## 🏗 Architectural Changes

### 1. Component Hierarchy
- `HighlightCard.jsx`: The atomic unit (Lucide icons, value, label, sub-value).
- `AttendanceHistoryHighlights.jsx`: A collection wrapper that maps data to `HighlightCard` components.

### 2. Data Structure
Highlights will follow a standardized schema:
```javascript
{
  id: string,       // Unique key for filtering (e.g., 'pending')
  label: string,    // Display title
  value: any,       // Primary metric
  subValue: string, // Contextual detail (e.g., 'Awaiting review')
  icon: ReactNode,  // Lucide icon component
  accentClass: string, // Theme color (e.g., 'is-blue')
  isActive: boolean    // Visual state for active filter
}
```

## 📅 Implementation Roadmap

### Phase 1: Foundation (Completed)
- [x] Create `src/components/shared/HighlightCard.jsx` and `.css`.
- [x] Refactor `AttendanceHistoryHighlights.jsx` to use the new card component.

### Phase 2: Logic & Interactivity (Completed)
- [x] Create `src/utils/highlightUtils.js` for centralized data building.
- [x] Implement `onClick` filtering logic in the highlights wrapper.

### Phase 3: Integration (Completed)
- [x] Update `AttendanceModule.jsx` to use the unified system.
- [x] Integrate into `AdminDashboard.jsx`.
- [x] Integrate into `CoachDashboard.jsx`.
- [x] Integrate into `EmployeeDashboard.jsx`.
- [x] Integrate into `SuperAdminDashboard.jsx`.

## 📝 Commit Subdivision
1. `feat: create unified HighlightCard component and styles`
2. `refactor: update AttendanceHistoryHighlights to use new HighlightCard`
3. `feat: centralize highlight building logic in highlightUtils`
4. `feat: add click-to-filter functionality to HighlightCard`
5. `refactor: integrate unified highlights into My Attendance tab`
6. `refactor: update My Requests and File Request tabs with unified highlights`
7. `refactor: update All Attendance tab with unified highlights`
8. `fix: ensure consistent accessibility and responsiveness for highlight cards`
9. `doc: update architectural reference and design standards for unified highlight system`
10. `refactor: remove redundant highlight logic from requests API`
11. `refactor: finalize interactive filtering in Admin and SuperAdmin dashboards`
