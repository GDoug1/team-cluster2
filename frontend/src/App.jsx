import { Routes, Route, Navigate } from "react-router-dom";

import Login from "./pages/Login";
import Register from "./pages/Register";
import AdminDashboard from "./pages/AdminDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import CoachDashboard from "./pages/CoachDashboard";
import EmployeeDashboard from "./pages/EmployeeDashboard";

import ProtectedRoute from "./routes/ProtectedRoute";
import { FeedbackProvider } from "./components/FeedbackProvider";

export default function App() {
  return (
    <FeedbackProvider>
      <Routes>
        {/* PUBLIC */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* PROTECTED */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/super-admin"
          element={
            <ProtectedRoute allowedRoles={["super admin"]}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/coach"
          element={
            <ProtectedRoute allowedRoles={["coach"]}>
              <CoachDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/coach/attendance"
          element={
            <ProtectedRoute allowedRoles={["coach"]}>
              <CoachDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employee"
          element={
            <ProtectedRoute>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />

        {/* FALLBACK */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </FeedbackProvider>
  );
}
