import { useEffect, useState } from "react";
import { apiFetch } from "../api/api";
import "../styles/ControlPanel.css";

export default function ControlPanelSection() {
  const [activeTab, setActiveTab] = useState("General");

  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);

  const [selectedRole, setSelectedRole] = useState(null);
  const [tempPermissions, setTempPermissions] = useState([]);

  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");

  const [logs, setLogs] = useState([]);
  const [archivedUsers, setArchivedUsers] = useState([]);

  const fetchRoles = async () => {
    const data = await apiFetch("api/control_panel/get_roles_with_permissions.php");
    if (data.success) {
      setRoles(data.data);
    }
  };

  const fetchUsers = async () => {
    const data = await apiFetch("api/control_panel/get_users_with_permissions.php");
    if (data.success) {
      setUsers(data.data);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, []);

  const handleOpenRole = role => {
    setSelectedRole(role);
    setTempPermissions([...(role.permissions ?? [])]);
  };

  const handleTogglePermission = permission => {
    setTempPermissions(previous =>
      previous.includes(permission)
        ? previous.filter(item => item !== permission)
        : [...previous, permission]
    );
  };

  const handleSaveRolePermissions = async () => {
    if (!selectedRole) return;

    await apiFetch("api/control_panel/update_role_permissions.php", {
      method: "POST",
      body: JSON.stringify({
        role_id: selectedRole.role_id,
        permissions: tempPermissions
      })
    });

    setSelectedRole(null);
    fetchRoles();
    fetchUsers();
  };

  const handleOpenUserPermissions = async user => {
    const data = await apiFetch(`api/control_panel/get_user_permissions.php?user_id=${user.id}`);

    if (data.success) {
      setSelectedUser(user);
      setUserPermissions(data.permissions);
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

  const fetchLogs = async () => {
    const data = await apiFetch("api/control_panel/get_logs.php");

    if (data.success) {
      setLogs(data.logs);
    }
  };

  useEffect(() => {
    if (activeTab === "Logs") {
      fetchLogs();
    }
  }, [activeTab]);

  const fetchArchivedUsers = async () => {
    const data = await apiFetch("api/control_panel/get_archived_users.php");

    if (data.success) {
      setArchivedUsers(data.users);
    }
  };

  useEffect(() => {
    if (activeTab === "User Archives") {
      fetchArchivedUsers();
    }
  }, [activeTab]);

  const restoreUser = async id => {
    await apiFetch("api/control_panel/restore_user.php", {
      method: "POST",
      body: JSON.stringify({ employee_id: id })
    });

    fetchArchivedUsers();
  };

  const deleteUser = async id => {
    const data = await apiFetch(`api/control_panel/delete_user_permanently.php?employee_id=${id}`, {
      method: "POST"
    });

    if (data.success) {
      fetchArchivedUsers();
    } else {
      alert(data.message);
    }
  };

  const filteredUsers = users.filter(user =>
    Object.values(user)
      .join(" ")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  const allPermissions = [...new Set(roles.flatMap(role => role.permissions ?? []))];

  return (
    <section className="content control-panel-content">
      <div className="control-panel-container">
        <div className="control-panel-header">
          <h2 className="control-panel-title">Control Panel</h2>
          <p className="control-panel-subtitle">Manage role-based permissions</p>
        </div>

        <div className="control-panel-tabs">
          {["General", "Search", "Logs", "User Archives"].map(tab => (
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

                  <button className="control-panel-permission-btn" onClick={() => handleOpenRole(role)}>
                    Edit Permissions
                  </button>
                </div>
              </div>
            ))}
          </div>
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
                          onClick={() => handleOpenUserPermissions(user)}
                        >
                          Permissions
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {activeTab === "User Archives" && (
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
              </tbody>
            </table>
          </div>
        )}

        {activeTab === "Logs" && (
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
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedRole && (
        <div className="control-panel-modal-overlay">
          <div className="control-panel-modal">
            <h3>{selectedRole.role_name}</h3>

            <div className="control-panel-permission-list">
              {allPermissions.map(permission => (
                <label key={permission}>
                  <input
                    type="checkbox"
                    checked={tempPermissions.includes(permission)}
                    onChange={() => handleTogglePermission(permission)}
                  />

                  {permission}
                </label>
              ))}
            </div>

            <div className="control-panel-modal-actions">
              <button className="control-panel-cancel-btn" onClick={() => setSelectedRole(null)}>
                Cancel
              </button>

              <button className="control-panel-apply-btn" onClick={handleSaveRolePermissions}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}

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
