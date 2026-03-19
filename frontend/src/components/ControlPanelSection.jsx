import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/api";
import { useFeedback } from "./FeedbackProvider";

const RESTRICTED_PERMISSIONS_BY_ROLE = {
  employee: new Set([
    "Access Control Panel",
    "Add Employee",
    "Edit Employee",
    "Delete Employee",
    "Set Attendance",
    "Edit Attendance",
    "View Employee List"
  ]),
  "team coach": new Set([
    "Access Control Panel",
    "Add Employee",
    "Edit Employee",
    "Delete Employee"
  ]),
  coach: new Set([
    "Access Control Panel",
    "Add Employee",
    "Edit Employee",
    "Delete Employee"
  ])
};

function getEditablePermissionOptions(roleName, permissionOptions) {
  const normalizedRole = String(roleName ?? "").trim().toLowerCase();
  const restrictedPermissions = RESTRICTED_PERMISSIONS_BY_ROLE[normalizedRole];
  if (!restrictedPermissions) {
    return permissionOptions;
  }

  return permissionOptions.filter(permission => !restrictedPermissions.has(permission.name));
}

function PermissionEditorModal({ title, selectedPermissionIds, permissionOptions, onClose, onSave, isSaving = false, errorMessage = "" }) {
  const [draftPermissionIds, setDraftPermissionIds] = useState(selectedPermissionIds);
  const selectedPermissionKey = useMemo(
    () => [...selectedPermissionIds].sort((a, b) => a - b).join(","),
    [selectedPermissionIds]
  );

  useEffect(() => {
    setDraftPermissionIds(selectedPermissionIds);
  }, [selectedPermissionKey]);

  const togglePermission = permissionId => {
    setDraftPermissionIds(current => {
      if (current.includes(permissionId)) {
        return current.filter(item => item !== permissionId);
      }
      return [...current, permissionId];
    });
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={`${title} permission editor`}>
      <div className="modal-card permission-modal">
        <h3 className="permission-modal-title">Edit Permission</h3>
        <p className="modal-subtitle">{title}</p>

        <div className="permission-modal-list" role="group" aria-label="Permission options">
          {permissionOptions.map(permission => (
            <label key={permission.id} className="permission-modal-item">
              <input type="checkbox" checked={draftPermissionIds.includes(permission.id)} onChange={() => togglePermission(permission.id)} />
              <span>{permission.name}</span>
            </label>
          ))}
        </div>

        <div className="permission-modal-actions">
          <button className="btn secondary" type="button" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button className="btn permission-save-btn" type="button" onClick={() => onSave(draftPermissionIds)} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </button>
        </div>

        {errorMessage ? <p className="team-empty-note">{errorMessage}</p> : null}
      </div>
    </div>
  );
}

function LogDetailsModal({ log, onClose }) {
  if (!log) return null;

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Log details" onClick={onClose}>
      <div className="modal-card log-details-modal" onClick={event => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="permission-modal-title">Log Details</h3>
            <p className="modal-subtitle">{log.action || "No action provided"}</p>
          </div>
          <button className="btn secondary" type="button" onClick={onClose}>Close</button>
        </div>

        <div className="log-details-grid">
          <div className="log-detail-card">
            <span className="log-detail-label">User</span>
            <span className="log-detail-value">{log.user || "-"}</span>
          </div>
          <div className="log-detail-card">
            <span className="log-detail-label">Date</span>
            <span className="log-detail-value">{log.created_at || "-"}</span>
          </div>
          <div className="log-detail-card log-detail-card-full">
            <span className="log-detail-label">Description</span>
            <p className="log-detail-description">{log.target || "-"}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ControlPanelSection() {
  const { confirm, showToast } = useFeedback();
  const [activeTab, setActiveTab] = useState("role");
  const [searchTerm, setSearchTerm] = useState("");
  const [permissionOptions, setPermissionOptions] = useState([]);
  const [rolePermissions, setRolePermissions] = useState([]);
  const [userPermissions, setUserPermissions] = useState([]);
  const [editingRoleId, setEditingRoleId] = useState("");
  const [editingUserId, setEditingUserId] = useState("");
  const [loadingRolePermissions, setLoadingRolePermissions] = useState(true);
  const [savingUserPermissions, setSavingUserPermissions] = useState(false);
  const [userSaveError, setUserSaveError] = useState("");

  const [archivedUsers, setArchivedUsers] = useState([]);
  const [loadingArchivedUsers, setLoadingArchivedUsers] = useState(false);
  const [archivedUsersError, setArchivedUsersError] = useState("");
  const [archiveActionEmployeeId, setArchiveActionEmployeeId] = useState(null);

  const [logs, setLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);

  const showRolePermissions = activeTab === "role";
  const showIndividualAccess = activeTab === "individual";
  const showLogs = activeTab === "logs";
  const showUserArchives = activeTab === "userArchives";

  useEffect(() => {
    let mounted = true;

    const loadControlPanelPermissions = async () => {
      try {
        const response = await apiFetch("api/admin/control_panel/permissions.php");
        if (!mounted) return;

        const options = Array.isArray(response.permissionOptions) ? response.permissionOptions : [];
        const roles = Array.isArray(response.rolePermissions) ? response.rolePermissions : [];
        const users = Array.isArray(response.userPermissions) ? response.userPermissions : [];

        setPermissionOptions(options.map(item => ({ id: item.id, name: item.name })));
        setRolePermissions(roles.map(role => ({
          id: String(role.id),
          roleId: role.id,
          role: role.role,
          description: role.description,
          permissionIds: Array.isArray(role.permissionIds) ? role.permissionIds : [],
          permissions: Array.isArray(role.permissions) ? role.permissions : []
        })));
        setUserPermissions(users.map(user => ({
          id: user.id,
          userId: user.userId,
          name: user.name,
          role: user.role,
          email: user.email,
          permissions: Array.isArray(user.permissions) ? user.permissions : []
        })));
      } catch {
        if (!mounted) return;
        setPermissionOptions([]);
        setRolePermissions([]);
        setUserPermissions([]);
      } finally {
        if (mounted) setLoadingRolePermissions(false);
      }
    };

    loadControlPanelPermissions();
    return () => {
      mounted = false;
    };
  }, []);

  const fetchArchivedUsers = async () => {
    setLoadingArchivedUsers(true);
    setArchivedUsersError("");
    try {
      const response = await apiFetch("api/admin/control_panel/get_archived_users.php");
      setArchivedUsers(Array.isArray(response?.users) ? response.users : []);
    } catch (error) {
      setArchivedUsers([]);
      setArchivedUsersError(error?.error ?? error?.message ?? "Unable to load archived users.");
    } finally {
      setLoadingArchivedUsers(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    setLogsError("");
    try {
      const response = await apiFetch("api/admin/control_panel/get_logs.php");
      setLogs(Array.isArray(response?.logs) ? response.logs : []);
    } catch (error) {
      setLogs([]);
      setLogsError(error?.error ?? error?.message ?? "Unable to load logs.");
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (showUserArchives) {
      fetchArchivedUsers();
    }
  }, [showUserArchives]);

  useEffect(() => {
    if (showLogs) {
      fetchLogs();
    }
  }, [showLogs]);

  const filteredRoles = useMemo(() => {
    const value = searchTerm.trim().toLowerCase();
    if (!value) return rolePermissions;
    return rolePermissions.filter(item => item.role.toLowerCase().includes(value)
      || item.description.toLowerCase().includes(value)
      || item.permissions.some(permission => permission.toLowerCase().includes(value)));
  }, [rolePermissions, searchTerm]);

  const filteredUsers = useMemo(() => {
    const value = searchTerm.trim().toLowerCase();
    if (!value) return userPermissions;
    return userPermissions.filter(item => item.name.toLowerCase().includes(value)
      || item.role.toLowerCase().includes(value)
      || item.email.toLowerCase().includes(value)
      || item.permissions.some(permission => permission.toLowerCase().includes(value)));
  }, [userPermissions, searchTerm]);

  const filteredArchivedUsers = useMemo(() => {
    const value = searchTerm.trim().toLowerCase();
    if (!value) return archivedUsers;
    return archivedUsers.filter(item => {
      const fullName = String(item.fullname ?? "").toLowerCase();
      const email = String(item.email ?? "").toLowerCase();
      const position = String(item.position ?? "").toLowerCase();
      return fullName.includes(value)
        || email.includes(value)
        || position.includes(value)
        || String(item.id ?? "").toLowerCase().includes(value);
    });
  }, [archivedUsers, searchTerm]);

  const filteredLogs = useMemo(() => {
    const value = searchTerm.trim().toLowerCase();
    if (!value) return logs;
    return logs.filter(item => String(item.user ?? "").toLowerCase().includes(value)
      || String(item.action ?? "").toLowerCase().includes(value)
      || String(item.target ?? "").toLowerCase().includes(value)
      || String(item.created_at ?? "").toLowerCase().includes(value));
  }, [logs, searchTerm]);

  const editingRole = rolePermissions.find(item => item.id === editingRoleId);
  const editingUser = userPermissions.find(item => item.id === editingUserId);
  const editingRolePermissionIds = useMemo(
    () => (editingRole?.permissionIds ?? []),
    [editingRole]
  );
  const editingRolePermissionOptions = useMemo(
    () => getEditablePermissionOptions(editingRole?.role, permissionOptions),
    [editingRole, permissionOptions]
  );
  const editingUserPermissionIds = useMemo(() => {
    if (!editingUser) return [];

    return editingUser.permissions
      .map(name => permissionOptions.find(option => option.name === name)?.id)
      .filter(Boolean);
  }, [editingUser, permissionOptions]);
  const editingUserPermissionOptions = useMemo(
    () => getEditablePermissionOptions(editingUser?.role, permissionOptions),
    [editingUser, permissionOptions]
  );

  const handleSaveRolePermissions = async permissionIds => {
    const role = rolePermissions.find(item => item.id === editingRoleId);
    if (!role) return;

    const shouldSave = await confirm({
      title: "Save role permissions?",
      message: `Update permissions for the ${role.role} role?`,
      confirmLabel: "Save"
    });
    if (!shouldSave) return;

    try {
      const response = await apiFetch("api/admin/control_panel/permissions.php", {
        method: "POST",
        body: JSON.stringify({ role_id: role.roleId, permission_ids: permissionIds })
      });

      const roles = Array.isArray(response.rolePermissions) ? response.rolePermissions : [];
      setRolePermissions(roles.map(item => ({
        id: String(item.id),
        roleId: item.id,
        role: item.role,
        description: item.description,
        permissionIds: Array.isArray(item.permissionIds) ? item.permissionIds : [],
        permissions: Array.isArray(item.permissions) ? item.permissions : []
      })));
      window.dispatchEvent(new Event("permissions-updated"));
      setEditingRoleId("");
      showToast({
        title: "Permissions updated",
        message: `${role.role} role permissions were saved successfully.`,
        type: "success"
      });
    } catch (error) {
      showToast({
        title: "Save failed",
        message: error?.error ?? error?.message ?? "Unable to save role permissions.",
        type: "error"
      });
    }
  };

  const handleSaveUserPermissions = async permissionIds => {
    const user = userPermissions.find(item => item.id === editingUserId);
    if (!user) return;

    const shouldSave = await confirm({
      title: "Save user permissions?",
      message: `Update permissions for ${user.name}?`,
      confirmLabel: "Save"
    });
    if (!shouldSave) return;

    setSavingUserPermissions(true);
    setUserSaveError("");

    try {
      const response = await apiFetch("api/admin/control_panel/user_permissions.php", {
        method: "POST",
        body: JSON.stringify({ user_id: user.userId, permission_ids: permissionIds })
      });

      const users = Array.isArray(response.userPermissions) ? response.userPermissions : [];
      setUserPermissions(users.map(item => ({
        id: item.id,
        userId: item.userId,
        name: item.name,
        role: item.role,
        email: item.email,
        permissions: Array.isArray(item.permissions) ? item.permissions : []
      })));
      window.dispatchEvent(new Event("permissions-updated"));
      setEditingUserId("");
      showToast({
        title: "Permissions updated",
        message: `${user.name}'s permissions were saved successfully.`,
        type: "success"
      });
    } catch (error) {
      const message = error?.error ?? "Unable to save user permissions.";
      setUserSaveError(message);
      showToast({
        title: "Save failed",
        message,
        type: "error"
      });
    } finally {
      setSavingUserPermissions(false);
    }
  };

  const handleArchiveAction = async (employeeId, endpointName, confirmMessage) => {
    const shouldProceed = await confirm({
      title: endpointName === "restore_user" ? "Restore archived user?" : "Delete archived user?",
      message: confirmMessage,
      confirmLabel: endpointName === "restore_user" ? "Restore" : "Delete",
      variant: endpointName === "restore_user" ? "primary" : "danger"
    });
    if (!shouldProceed) return;

    setArchiveActionEmployeeId(employeeId);
    setArchivedUsersError("");

    try {
      await apiFetch(`api/admin/control_panel/${endpointName}.php`, {
        method: "POST",
        body: JSON.stringify({ employee_id: employeeId })
      });

      setArchivedUsers(current => current.filter(item => item.id !== employeeId));
      await fetchLogs();
      showToast({
        title: endpointName === "restore_user" ? "User restored" : "User deleted",
        message: endpointName === "restore_user"
          ? "The archived user was restored successfully."
          : "The archived user was deleted permanently.",
        type: "success"
      });
    } catch (error) {
      const message = error?.error ?? error?.message ?? "Unable to update archived user.";
      setArchivedUsersError(message);
      showToast({
        title: "Action failed",
        message,
        type: "error"
      });
    } finally {
      setArchiveActionEmployeeId(null);
    }
  };

  return (
    <section className="control-panel-content" aria-label="Control panel permission editor">
      <header className="control-panel-header">
        <h2>Control Panel</h2>
        <p>Manage access rights by role or assign custom permissions to a specific user.</p>
      </header>

      <div className="control-panel-tabs" role="tablist" aria-label="Permission view mode">
        <button className={`control-panel-tab${showRolePermissions ? " active" : ""}`} type="button" role="tab" aria-selected={showRolePermissions} onClick={() => setActiveTab("role")}>By Role</button>
        <button className={`control-panel-tab${showIndividualAccess ? " active" : ""}`} type="button" role="tab" aria-selected={showIndividualAccess} onClick={() => setActiveTab("individual")}>Individual Access</button>
        <button className={`control-panel-tab${showLogs ? " active" : ""}`} type="button" role="tab" aria-selected={showLogs} onClick={() => setActiveTab("logs")}>Logs</button>
        <button className={`control-panel-tab${showUserArchives ? " active" : ""}`} type="button" role="tab" aria-selected={showUserArchives} onClick={() => setActiveTab("userArchives")}>User Archives</button>
      </div>

      <input
        className="control-panel-search"
        type="search"
        value={searchTerm}
        onChange={event => setSearchTerm(event.target.value)}
        placeholder={showRolePermissions
          ? "Search role or permission..."
          : showUserArchives
            ? "Search archived user, email, or position..."
            : showLogs
              ? "Search logs by user, action, or details..."
              : "Search user, role, or permission..."}
      />

      {showRolePermissions ? (
        loadingRolePermissions ? <p className="team-empty-note">Loading role permissions...</p> : (
          <div className="permission-card-grid">
            {filteredRoles.map(roleItem => (
              <article key={roleItem.id} className="permission-card">
                <div className="permission-card-header">{roleItem.role}</div>
                <div className="permission-card-body">
                  <p className="permission-card-label">{roleItem.description}</p>
                  <ul>{roleItem.permissions.map(permission => <li key={`${roleItem.id}-${permission}`}>{permission}</li>)}</ul>
                  <button className="btn permission-edit-btn" type="button" onClick={() => setEditingRoleId(roleItem.id)}>Edit Permission</button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : showIndividualAccess ? (
        <div className="control-panel-table-wrap" role="table" aria-label="Individual permission table">
          <div className="control-panel-table-header" role="row">
            <span role="columnheader">ID</span><span role="columnheader">User</span><span role="columnheader">Role</span><span role="columnheader">Permissions</span><span role="columnheader">Action</span>
          </div>
          {filteredUsers.map(userItem => (
            <div key={userItem.id} className="control-panel-table-row" role="row">
              <span role="cell" data-label="ID">{userItem.id}</span><span role="cell" data-label="User">{userItem.name}</span><span role="cell" data-label="Role">{userItem.role}</span><span role="cell" data-label="Permissions">{userItem.permissions.length}</span>
              <span role="cell" data-label="Action"><button className="btn permission-edit-btn" type="button" onClick={() => { setUserSaveError(""); setEditingUserId(userItem.id); }}>Edit Permission</button></span>
            </div>
          ))}
        </div>
      ) : showLogs ? (
        <>
          {logsError ? <p className="team-empty-note">{logsError}</p> : null}
          {loadingLogs ? <p className="team-empty-note">Loading logs...</p> : filteredLogs.length === 0 ? <p className="team-empty-note">No logs found.</p> : (
            <div className="control-panel-table-wrap control-panel-logs-table" role="table" aria-label="Control panel logs table">
              <div className="control-panel-table-header" role="row">
                <span role="columnheader">ID</span><span role="columnheader">User</span><span role="columnheader">Action</span><span role="columnheader">View</span><span role="columnheader">Date</span>
              </div>
              {filteredLogs.map(logItem => (
                <div key={logItem.id} className="control-panel-table-row" role="row">
                  <span role="cell" data-label="ID">{logItem.id}</span>
                  <span role="cell" data-label="User">{logItem.user}</span>
                  <span role="cell" data-label="Action">{logItem.action || "-"}</span>
                  <span role="cell" data-label="View">
                    <button className="btn secondary log-view-btn" type="button" onClick={() => setSelectedLog(logItem)}>
                      View
                    </button>
                  </span>
                  <span role="cell" data-label="Date">{logItem.created_at || "-"}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          {archivedUsersError ? <p className="team-empty-note">{archivedUsersError}</p> : null}
          {loadingArchivedUsers ? <p className="team-empty-note">Loading archived users...</p> : filteredArchivedUsers.length === 0 ? <p className="team-empty-note">No archived users found.</p> : (
            <div className="control-panel-table-wrap" role="table" aria-label="User archives table">
              <div className="control-panel-table-header" role="row">
                <span role="columnheader">ID</span><span role="columnheader">User</span><span role="columnheader">Position</span><span role="columnheader">Action</span>
              </div>
              {filteredArchivedUsers.map(userItem => (
                <div key={userItem.id} className="control-panel-table-row" role="row">
                  <span role="cell" data-label="ID">{userItem.id}</span>
                  <span role="cell" data-label="User">{userItem.fullname || userItem.email || `Employee #${userItem.id}`}</span>
                  <span role="cell" data-label="Position">{userItem.position || "—"}</span>
                  <span role="cell" data-label="Action" className="user-archive-actions">
                    <button className="btn secondary" type="button" onClick={() => handleArchiveAction(userItem.id, "restore_user", "Restore this archived user?")} disabled={archiveActionEmployeeId === userItem.id}>
                      {archiveActionEmployeeId === userItem.id ? "Updating..." : "Restore"}
                    </button>
                    <button className="btn danger" type="button" onClick={() => handleArchiveAction(userItem.id, "delete_user_permanently", "Permanently delete this archived user record? This cannot be undone.")} disabled={archiveActionEmployeeId === userItem.id}>
                      Permanently Delete
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editingRole ? (
        <PermissionEditorModal
          title={`${editingRole.role} Role`}
          selectedPermissionIds={editingRolePermissionIds}
          permissionOptions={editingRolePermissionOptions}
          onClose={() => setEditingRoleId("")}
          onSave={handleSaveRolePermissions}
        />
      ) : null}

      {editingUser ? (
        <PermissionEditorModal
          title={`${editingUser.name} (${editingUser.role})`}
          selectedPermissionIds={editingUserPermissionIds}
          permissionOptions={editingUserPermissionOptions}
          onClose={() => setEditingUserId("")}
          onSave={handleSaveUserPermissions}
          isSaving={savingUserPermissions}
          errorMessage={userSaveError}
        />
      ) : null}

      {selectedLog ? (
        <LogDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} />
      ) : null}
    </section>
  );
}


