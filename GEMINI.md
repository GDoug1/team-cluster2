# GEMINI.md

This file serves as the foundational context for interaction with the **Team Cluster 2** project. It provides an overview of the system architecture, development conventions, and key operational details.

---

## 🚀 Project Overview

**Team Cluster 2** is a role-based team management and attendance tracking system. It is structured as a full-stack web application with a monolithic PHP backend and a modern React frontend.

### 🛠 Tech Stack
- **Frontend:** [React 19](https://react.dev/), [Vite 7](https://vite.dev/), Vanilla CSS.
- **Backend:** PHP (Procedural/Object-Oriented hybrid), MySQL (mysqli).
- **Environment:** Designed for local development with XAMPP (or equivalent) for the backend and Node.js for the frontend.

### 🏛 Architecture
- **Monolithic Backend:** Serves as a RESTful-ish API for the frontend, organized by user roles (`admin`, `coach`, `employee`).
- **Single Page Application (SPA):** The frontend is a React application that manages its own routing and state through a custom path-based orchestrator in `App.jsx`.
- **Database Architecture:** Centralized in `system_hris_db`, managing users, employees, roles, and activity logs.

---

## 📂 Project Structure

- **`backend/`**: Contains the PHP API logic, configuration, and authentication.
    - `api/`: Role-based endpoint handlers.
    - `auth/`: Login, registration, and session management.
    - `config/`: Database and authentication settings.
- **`frontend/`**: Contains the React source code and assets.
    - `src/api/`: Frontend-side API wrappers.
    - `src/components/`: Self-contained UI modules (e.g., `EmployeesSection.jsx`).
    - `src/pages/`: Main dashboard views for different roles.
- **`docs/`**: Technical guides and database schemas.

---

## ⚙️ Building and Running

### Prerequisites
- **Node.js** (for frontend)
- **PHP 8+** & **MySQL** (for backend, typically via XAMPP)

### Frontend Setup
1. Navigate to `frontend/`.
2. Install dependencies: `npm install`.
3. Start the development server: `npm run dev`.
   - Access at `http://localhost:5173`.

### Backend Setup
1. Ensure your PHP environment is pointing to the root directory.
2. Configure the database in `backend/config/database.php`.
3. The database schema can be found in `docs/db/schema.sql`.

### Development Commands
- **Vite Dev:** `npm run dev`
- **Build Frontend:** `npm run build`
- **Linting:** `npm run lint`

---

## 🛠 Development Conventions

### 1. Authentication & RBAC
- **Session-based Auth:** Managed in `backend/auth/login.php`.
- **Role-Based Access Control (RBAC):** Roles (`super admin`, `admin`, `coach`, `employee`) are normalized from the database and enforced at both the API level (via `requireRole`) and UI level (via `usePermissions` hook).

### 2. Frontend Patterns
- **Dashboard Orchestrator:** Dashboards (e.g., `CoachDashboard.jsx`) use a state-based navigation pattern (`activeNav`) to swap between featured modules.
- **Self-Contained Modules:** UI sections should be self-contained components in `frontend/src/components/` that manage their own API interactions.

### 3. Backend Patterns
- **Role-Based API Structure:** Always place new handlers in the appropriate role subfolder in `backend/api/`.
- **Database Consistency:** Use the shared `database.php` config and follow the existing `mysqli` prepared statement pattern.
- **Logging:** All critical user actions should be logged using `logAction($conn, $user_id, $action, $target)` in `backend/api/utils/logger.php`.

### 4. API Integration
- Frontend calls are typically grouped in `frontend/src/api/` (e.g., `attendance.js`, `requests.js`) to provide a clean abstraction for components.

---

## 🛠 Source Control & Workflow

### 1. Commit Message Convention
All commits must follow the standard convention:
- **Format:** `<type>: <description>`
- **Types:** `feat`, `fix`, `chore`, `doc`, `perf`, `refactor`.
- **Mood:** Always use the **imperative mood** (e.g., `fix: update logic` NOT `fixed: updated logic`).

### 2. Branching Strategy
- **New Features:** Create a branch prefixed with `feat/` (e.g., `git checkout -b feat/new-api-endpoint`).
- **Refactoring:** Create a branch prefixed with `refactor/`.
- **Bug Fixes:** Use `fix/`.

---

## ⚡ Efficiency Mandates

- **Turn Limit:** If a task requires more than 5 consecutive tool calls or high-volume data processing that may exceed a few minutes, the agent MUST stop and provide a progress report to the user.
- **Background Tasks:** For any command that might take significant time (e.g., complex builds), the agent must explicitly ask to run it with `is_background: true`.
- **Parallelization:** Always execute independent search or read operations in parallel to minimize latency.

---

## 📖 Key Documentation
- **UI/UX Technical Standards:** `docs/design/STANDARDS.md`
- **Architectural Reference:** `docs/ARCHITECTURAL_REFERENCE.md`
- **Backend API Guide:** `docs/BACKEND_API_GUIDE.md`
- **Frontend Guide:** `docs/FRONTEND_GUIDE.md`
- **QA & Testing:** `docs/qa/ATTENDANCE_TEST_CASES.md`
