import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/api";
import "../styles/ControlPanel.css";

const CONTROL_PANEL_TABS = ["General", "Search", "Logs", "User Archives"];

export default function ControlPanelSection() {
  const [activeTab, setActiveTab] = useState("General");

  const [roles, setRoles] = useState([]);
  const [permissionsCatalog, setPermissionsCatalog] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);
  const [rolesError, setRolesError] = useState("");
  const [roleEditorRoleId, setRoleEditorRoleId] = useState(null);
  const [roleEditorPermissions, setRoleEditorPermissions] = useState([]);
  const [roleSaveLoading, setRoleSaveLoading] = useState(false);
  const [roleSaveError, setRoleSaveError] = useState("");

  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState("");

  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);
  const [userPermissionLoading, setUserPermissionLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");

  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");

  const [archivedUsers, setArchivedUsers] = useState([]);
  const [archivedUsersLoading, setArchivedUsersLoading] = useState(false);
  const [archivedUsersError, setArchivedUsersError] = useState("");

  const fetchRoles = useCallback(async () => {
    setRolesLoading(true);
    setRolesError("");

    try {
      const data = await apiFetch("api/control_panel/get_roles_with_permissions.php");
      if (data.success) {
        setRoles(data.data);
        setPermissionsCatalog(data.permissions_catalog ?? []);
      } else {
        setRoles([]);
        setPermissionsCatalog([]);
        setRolesError(data?.message ?? "Unable to load roles.");
      }
    } catch (error) {
      setRoles([]);
      setPermissionsCatalog([]);
      setRolesError(error?.error ?? "Unable to load roles. Please refresh and try again.");
    } finally {
      setRolesLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersError("");

    try {
      const data = await apiFetch("api/control_panel/get_users_with_permissions.php");
      if (data.success) {
        setUsers(data.data);
      } else {
        setUsers([]);
        setUsersError(data?.message ?? "Unable to load users.");
      }
    } catch (error) {
      setUsers([]);
      setUsersError(error?.error ?? "Unable to load users. Please refresh and try again.");
    } finally {
      setUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, [fetchRoles, fetchUsers]);

  const handleOpenRoleEditor = role => {
    setRoleEditorRoleId(role.role_id);
    setRoleEditorPermissions([...(role.permissions ?? [])]);
    setRoleSaveError("");
  };

  const handleTogglePermission = permission => {
    setRoleEditorPermissions(previous =>
      previous.includes(permission)
        ? previous.filter(item => item !== permission)
        : [...previous, permission]
    );
  };

  const handleSaveRolePermissions = async () => {
    if (!roleEditorRoleId) return;

    setRoleSaveLoading(true);
    setRoleSaveError("");

    try {
      const data = await apiFetch("api/control_panel/update_role_permissions.php", {
        method: "POST",
        body: JSON.stringify({
          role_id: roleEditorRoleId,
          permissions: roleEditorPermissions
        })
      });

      if (!data.success) {
        setRoleSaveError(data?.message ?? "Unable to save role permissions.");
        return;
      }

      setRoleEditorRoleId(null);
      setRoleEditorPermissions([]);
      fetchRoles();
      fetchUsers();
    } catch (error) {
      setRoleSaveError(error?.error ?? "Unable to save role permissions.");
    } finally {
      setRoleSaveLoading(false);
    }
  };

  const handleOpenUserPermissions = async user => {
    setUserPermissionLoading(true);

    try {
      const data = await apiFetch(`api/control_panel/get_user_permissions.php?user_id=${user.id}`);

      if (data.success) {
        setSelectedUser(user);
        setUserPermissions(data.permissions);
      }
    } finally {
      setUserPermissionLoading(false);
    }
  };

  const toggleUserPermission = permissionId => {
    setUserPermissions(previous =>
      previous.map(permission =>
        permission.permission_id === permissionId
          ? { ...permission, allowed: permission.allowed === 1 ? 0 : 1 }
          : permission
      )
    );
  };

  const saveUserPermissions = async () => {
    if (!selectedUser) return;

    const data = await apiFetch("api/control_panel/update_user_permissions.php", {
      method: "POST",
      body: JSON.stringify({
        user_id: selectedUser.id,
        permissions: userPermissions
      })
    });

    if (data.success) {
      setSelectedUser(null);
      fetchUsers();
    }
  };

  const fetchLogs = useCallback(async () => {
    setLogsLoading(true);
    setLogsError("");

    try {
      const data = await apiFetch("api/control_panel/get_logs.php");

      if (data.success) {
        setLogs(data.logs);
      } else {
        setLogs([]);
        setLogsError(data?.message ?? "Unable to load logs.");
      }
    } catch (error) {
      setLogs([]);
      setLogsError(error?.error ?? "Unable to load logs. Please refresh and try again.");
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "Logs") {
      fetchLogs();
    }
  }, [activeTab, fetchLogs]);

  const fetchArchivedUsers = useCallback(async () => {
    setArchivedUsersLoading(true);
    setArchivedUsersError("");

    try {
      const data = await apiFetch("api/control_panel/get_archived_users.php");

      if (data.success) {
        setArchivedUsers(data.users);
      } else {
        setArchivedUsers([]);
        setArchivedUsersError(data?.message ?? "Unable to load archived users.");
      }
    } catch (error) {
      setArchivedUsers([]);
      setArchivedUsersError(error?.error ?? "Unable to load archived users. Please refresh and try again.");
    } finally {
      setArchivedUsersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === "User Archives") {
      fetchArchivedUsers();
    }
  }, [activeTab, fetchArchivedUsers]);

  const restoreUser = async id => {
    await apiFetch("api/control_panel/restore_user.php", {
      method: "POST",
      body: JSON.stringify({ employee_id: id })
    });

    fetchArchivedUsers();
  };

  const deleteUser = async id => {
    const data = await apiFetch("api/control_panel/delete_user_permanently.php", {
      method: "POST",
      body: JSON.stringify({ employee_id: id })
    });

    if (data.success) {
      fetchArchivedUsers();
      return;
    }

    alert(data.message);
  };

  const filteredUsers = useMemo(
    () => users.filter(user =>
      Object.values(user)
        .join(" ")
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    ),
    [users, searchTerm]
  );

  const allPermissions = useMemo(
    () => [...new Set([...(permissionsCatalog ?? []), ...roles.flatMap(role => role.permissions ?? [])])],
    [permissionsCatalog, roles]
  );

  return (
    <section className="content control-panel-content">
      <div className="control-panel-container">
        <div className="control-panel-header">
          <h2 className="control-panel-title">Control Panel</h2>
          <p className="control-panel-subtitle">Manage role-based permissions</p>
        </div>

        <div className="control-panel-tabs">
          {CONTROL_PANEL_TABS.map(tab => (
            <button
              key={tab}
              className={`control-panel-tab ${activeTab === tab ? "active" : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === "General" && (
          <>
            {rolesError && (
              <div className="control-panel-empty-state" role="alert">
                <p>{rolesError}</p>
                <button className="control-panel-permission-btn" onClick={fetchRoles}>
                  Retry
                </button>
              </div>
            )}

            {!rolesError && rolesLoading && <p className="control-panel-status">Loading permissions...</p>}

            {!rolesError && !rolesLoading && roles.length === 0 && (
              <div className="control-panel-empty-state">
                <p>No permission cards were found for this account.</p>
                <p>Try re-logging in, then open this page again.</p>
              </div>
            )}

            {!rolesError && !rolesLoading && roles.length > 0 && (
              <div className="control-panel-grid">
                {roles.map(role => (
                  <div key={role.role_id} className="control-panel-card">
                    <div className="control-panel-card-header">{role.role_name}</div>

                    <div className="control-panel-card-body">
                      <p className="control-panel-permission-title">Permissions:</p>

                      <ul>
                        {(role.permissions ?? []).map(permission => (
                          <li key={`${role.role_id}-${permission}`}>{permission}</li>
                        ))}
                      </ul>

                      {roleEditorRoleId === role.role_id ? (
                        <>
                          <div className="control-panel-permission-list role-editor-list">
                            {allPermissions.map(permission => (
                              <label key={`${role.role_id}-edit-${permission}`}>
                                <input
                                  type="checkbox"
                                  checked={roleEditorPermissions.includes(permission)}
                                  onChange={() => handleTogglePermission(permission)}
                                />

                                {permission}
                              </label>
                            ))}
                          </div>

                          {roleSaveError && <p className="control-panel-modal-error">{roleSaveError}</p>}

                          <div className="control-panel-role-actions">
                            <button
                              className="control-panel-cancel-btn"
                              onClick={() => {
                                setRoleEditorRoleId(null);
                                setRoleEditorPermissions([]);
                                setRoleSaveError("");
                              }}
                            >
                              Cancel
                            </button>

                            <button
                              className="control-panel-apply-btn"
                              disabled={roleSaveLoading}
                              onClick={handleSaveRolePermissions}
                            >
                              {roleSaveLoading ? "Saving..." : "Save"}
                            </button>
                          </div>
                        </>
                      ) : (
                        <button className="control-panel-permission-btn" onClick={() => handleOpenRoleEditor(role)}>
                          Edit Permissions
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === "Search" && (
          <>
            <div className="control-panel-search-bar">
              <input
                type="text"
                placeholder="Search a User..."
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
              />
            </div>

            {usersError && (
              <div className="control-panel-empty-state" role="alert">
                <p>{usersError}</p>
                <button className="control-panel-permission-btn" onClick={fetchUsers}>
                  Retry
                </button>
              </div>
            )}

            {!usersError && usersLoading && <p className="control-panel-status">Loading users...</p>}

            {!usersError && !usersLoading && (
              <div className="control-panel-table-wrapper">
                <table className="control-panel-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Full Name</th>
                      <th>Role</th>
                      <th>Position</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredUsers.map(user => (
                      <tr key={user.id}>
                        <td>{user.id}</td>
                        <td>{user.fullName}</td>
                        <td>{user.role}</td>
                        <td>{user.position}</td>

                        <td>
                          <button
                            className="control-panel-permission-btn"
                            disabled={userPermissionLoading}
                            onClick={() => handleOpenUserPermissions(user)}
                          >
                            {userPermissionLoading ? "Loading..." : "Permissions"}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="control-panel-status">No users found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === "User Archives" && (
          <>
            {archivedUsersError && (
              <div className="control-panel-empty-state" role="alert">
                <p>{archivedUsersError}</p>
                <button className="control-panel-permission-btn" onClick={fetchArchivedUsers}>
                  Retry
                </button>
              </div>
            )}

            {!archivedUsersError && archivedUsersLoading && <p className="control-panel-status">Loading archived users...</p>}

            {!archivedUsersError && !archivedUsersLoading && (
              <div className="control-panel-table-wrapper">
                <table className="control-panel-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Full Name</th>
                      <th>Position</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {archivedUsers.map(user => (
                      <tr key={user.employee_id}>
                        <td>{user.employee_id}</td>
                        <td>{user.fullName}</td>
                        <td>{user.position}</td>

                        <td>
                          <button
                            className="control-panel-restore-btn"
                            onClick={() => {
                              if (confirm("Restore this employee?")) {
                                restoreUser(user.employee_id);
                              }
                            }}
                          >
                            Restore
                          </button>

                          <button
                            className="control-panel-delete-btn"
                            onClick={() => {
                              if (confirm("Permanently delete this employee?")) {
                                deleteUser(user.employee_id);
                              }
                            }}
                          >
                            Delete Permanently
                          </button>
                        </td>
                      </tr>
                    ))}
                    {archivedUsers.length === 0 && (
                      <tr>
                        <td colSpan={4} className="control-panel-status">No archived users found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {activeTab === "Logs" && (
          <>
            {logsError && (
              <div className="control-panel-empty-state" role="alert">
                <p>{logsError}</p>
                <button className="control-panel-permission-btn" onClick={fetchLogs}>
                  Retry
                </button>
              </div>
            )}

            {!logsError && logsLoading && <p className="control-panel-status">Loading logs...</p>}

            {!logsError && !logsLoading && (
              <div className="control-panel-table-wrapper">
                <table className="control-panel-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>User</th>
                      <th>Action</th>
                      <th>Target</th>
                      <th>Date</th>
                    </tr>
                  </thead>

                  <tbody>
                    {logs.map(log => (
                      <tr key={log.id}>
                        <td>{log.id}</td>
                        <td>{log.user}</td>
                        <td>{log.action}</td>
                        <td>{log.target}</td>
                        <td>{log.date}</td>
                      </tr>
                    ))}
                    {logs.length === 0 && (
                      <tr>
                        <td colSpan={5} className="control-panel-status">No logs found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
      {selectedUser && (
        <div className="control-panel-modal-overlay">
          <div className="control-panel-modal">
            <h3>{selectedUser.fullName}</h3>

            <div className="control-panel-permission-list">
              {userPermissions.map(permission => (
                <label key={permission.permission_id}>
                  <input
                    type="checkbox"
                    checked={permission.allowed === 1}
                    onChange={() => toggleUserPermission(permission.permission_id)}
                  />

                  {permission.permission_name}
                </label>
              ))}
            </div>

            <div className="control-panel-modal-actions">
              <button className="control-panel-cancel-btn" onClick={() => setSelectedUser(null)}>
                Cancel
              </button>

              <button className="control-panel-apply-btn" onClick={saveUserPermissions}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
