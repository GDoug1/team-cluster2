# Frontend Feature Migration Strategy & Optimization Guide

This document outlines the standardized approach for migrating **frontend-only** features from previous codebases (such as the legacy HRIS system) into the **Team Cluster 2** project. It focuses on porting UI components while ensuring they integrate seamlessly with the existing PHP backend and the project's React Dashboard architecture.

---

## 1. Architectural Context
Before starting any migration, understand how frontend features are "wired" into this project:

### Frontend (React SPA)
- **Dashboard Orchestrator:** Features are integrated via a state-based navigation pattern (e.g., `CoachDashboard.jsx`).
- **Featured Modules:** Located in `frontend/src/components/` (e.g., `EmployeesSection.jsx`). These are self-contained components managing their own state and internal sub-views.
- **Routing:** Handled via the `activeNav` state within the Dashboard pages rather than a global router like `react-router`.
- **State Management:** Prefers local `useState`/`useReducer` or custom hooks (e.g., `usePermissions.js`) over heavyweight global stores.

### Backend (PHP Procedural)
- **Pre-existing API:** The backend for the feature already exists or is built separately using the role-based handlers in `backend/api/`.
- **Data Contract:** Migrated frontend components must be updated to match the existing API response structures of the current project.

---

## 2. The Migration Workflow (Frontend-Only)

### Phase 1: Component Extraction
- **Isolate UI Logic:** Use the **[MCP Server Code Extractor](https://github.com/ctoth/mcp_server_code_extractor)** to semantically pull the React components and their internal logic from the source codebase.
- **Dependency Audit:** Check for external libraries (e.g., specialized charting or UI kits) in the source's `package.json` and decide if they should be installed or replaced with vanilla alternatives.

### Phase 2: State & Context Adaptation
- **Legacy State Porting:** If the source uses Redux/Zustand, refactor it into the project's local component state pattern.
- **Hook Integration:** Wrap the migrated UI with the project's standard hooks:
    - `useCurrentUser.js` for user context.
    - `usePermissions.js` for access control.
    - `useLiveDateTime.js` for consistent UI time-tracking.

### Phase 3: Style Alignment
- **CSS Migration:** Port styles into `frontend/src/styles/` or as scoped styles within the component.
- **Theming:** Ensure the migrated UI uses the project's color palette and typography defined in `frontend/src/index.css` and `App.css`.

### Phase 4: API Wiring
- **Endpoint Mapping:** Locate where the source frontend makes API calls. Update these to point to the `backend/api/` role-based handlers.
- **Normalization:** Ensure the data coming from the PHP backend is normalized before being consumed by the migrated component.

---

## 3. Resource Toolbox

### Specialized MCP Servers
| Tool | Purpose | Link |
| :--- | :--- | :--- |
| **Code Extractor** | Semantic extraction of React components | [GitHub](https://github.com/ctoth/mcp_server_code_extractor) |
| **Refactor MCP** | Context-aware API path renaming | [MCP Market](https://mcpmarket.com/) |

### Agent Skills (`npx skills add <name>`)
| Skill Name | Usage | Documentation |
| :--- | :--- | :--- |
| `dashboard-customizations` | React dashboard integration | [skills.sh](https://skills.sh/medusajs/medusa-agent-skills/building-admin-dashboard-customizations) |
| `ui-ux-pro-max` | Polishing migrated components | Built-in |

---

## 4. Frontend-Only Checklist
When creating a new `{Feature}Section.jsx`, ensure it satisfies these project-specific requirements:
- [ ] Uses `usePermissions()` hook for feature-level access control.
- [ ] API calls are abstracted into `frontend/src/api/` files.
- [ ] Follows the accessibility guidelines in `extension_context` (ARIA labels, keyboard nav).
- [ ] Uses consistent styling with `frontend/src/styles/MainDashboard.css`.
- [ ] Logic is contained within a single "Section" component for easy Dashboard integration.

---

## 5. References
- **Component Design:** [React Docs - Thinking in React](https://react.dev/learn/thinking-in-react)
- **Frontend-Only Migration:** [Dev.to - Porting React Components](https://dev.to/search?q=porting+react+components)
