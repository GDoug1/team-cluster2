import { useMemo } from "react";

const ROLE_DEFAULT_PERMISSIONS = {
  "super admin": [
    "Add Employee",
    "Edit Employee",
    "Delete Employee",
    "Set Attendance",
    "Edit Attendance",
    "View Dashboard",
    "View Team",
    "View Attendance",
    "View Employee List",
    "Edit Profile",
    "Access Control Panel"
  ],
  admin: [
    "Add Employee",
    "Edit Employee",
    "Delete Employee",
    "Set Attendance",
    "Edit Attendance",
    "View Dashboard",
    "View Team",
    "View Attendance",
    "View Employee List",
    "Edit Profile"
  ],
  coach: ["Edit Attendance", "View Dashboard", "View Team", "View Attendance", "View Employee List"],
  employee: ["View Dashboard", "View Team", "View Attendance"]
};

const normalizeRole = role => {
  const normalizedRole = String(role ?? "").trim().toLowerCase();
  if (normalizedRole.includes("super") && normalizedRole.includes("admin")) return "super admin";
  if (normalizedRole.includes("admin")) return "admin";
  if (normalizedRole.includes("coach")) return "coach";
  return "employee";
};

export default function usePermissions(user) {
  const grantedPermissions = useMemo(() => {
    const apiPermissions = Array.isArray(user?.permissions)
      ? user.permissions.filter(permission => typeof permission === "string")
      : [];

    if (apiPermissions.length > 0) {
      return new Set(apiPermissions);
    }

    const fallbackByRole = ROLE_DEFAULT_PERMISSIONS[normalizeRole(user?.role)] ?? [];
    return new Set(fallbackByRole);
  }, [user]);

  const can = permissionName => grantedPermissions.has(permissionName);

  return { grantedPermissions, can };
}
