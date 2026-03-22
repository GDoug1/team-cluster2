export function getFeatureAccess(hasPermission) {
  const canViewDashboard = hasPermission("View Dashboard");
  const canViewTeam = hasPermission("View Team");
  const canViewAttendance = hasPermission("View Attendance");
  const canSetAttendance = hasPermission("Set Attendance");
  const canEditAttendance = hasPermission("Edit Attendance");
  const canAccessControlPanel = hasPermission("Access Control Panel");
  const canViewEmployeeList = hasPermission("View Employee List");
  const canAddEmployee = hasPermission("Add Employee");
  const canEditEmployee = hasPermission("Edit Employee");
  const canDeleteEmployee = hasPermission("Delete Employee");
  const canAccessEmployeesTab = canViewEmployeeList || canAddEmployee || canEditEmployee || canDeleteEmployee;

  return {
    canViewDashboard,
    canViewTeam,
    canViewAttendance,
    canSetAttendance,
    canEditAttendance,
    canAccessControlPanel,
    canViewEmployeeList,
    canAddEmployee,
    canEditEmployee,
    canDeleteEmployee,
    canAccessEmployeesTab
  };
}
