import { useState, useEffect } from "react";
import "../styles/ControlPanel.css";
import DashboardSidebar from "./DashboardSidebar";
import { apiFetch } from "../api/api";

/* =========================
   TYPES
========================= */

type Role = {
  role_id: number;
  role_name: string;
  permissions: string[];
};

type UserRow = {
  id: number;
  fullName: string;
  role: string;
  position: string;
};

type UserPermission = {
  permission_id: number;
  permission_name: string;
  allowed: number;
};

const ControlPanel = () => {

  const [activeTab, setActiveTab] = useState("General");

  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);

  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [tempPermissions, setTempPermissions] = useState<string[]>([]);

  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);

  const [searchTerm, setSearchTerm] = useState("");

  /* =========================
     FETCH ROLES
  ========================== */

  const fetchRoles = async () => {
    const data = await apiFetch("control_panel/get_roles_with_permissions.php");

    if (data.success) {
      setRoles(data.data);
    }
  };

  /* =========================
     FETCH USERS
  ========================== */

  const fetchUsers = async () => {
    const data = await apiFetch("control_panel/get_users_with_permissions.php");

    if (data.success) {
      setUsers(data.data);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchUsers();
  }, []);

  /* =========================
     ROLE PERMISSION MODAL
  ========================== */

  const handleOpenRole = (role: Role) => {
    setSelectedRole(role);
    setTempPermissions([...role.permissions]);
  };

  const handleTogglePermission = (permission: string) => {
    setTempPermissions((prev) =>
      prev.includes(permission)
        ? prev.filter((p) => p !== permission)
        : [...prev, permission]
    );
  };

  const handleSaveRolePermissions = async () => {

    if (!selectedRole) return;

    await apiFetch("control_panel/update_role_permissions.php", {
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

  /* =========================
     USER PERMISSION MODAL
  ========================== */

  const handleOpenUserPermissions = async (user: UserRow) => {

    const data = await apiFetch(
      `control_panel/get_user_permissions.php?user_id=${user.id}`
    );

    if (data.success) {
      setSelectedUser(user);
      setUserPermissions(data.permissions);
    }
  };

  const toggleUserPermission = (permission_id: number) => {

    setUserPermissions((prev) =>
      prev.map((perm) =>
        perm.permission_id === permission_id
          ? { ...perm, allowed: perm.allowed === 1 ? 0 : 1 }
          : perm
      )
    );
  };

const saveUserPermissions = async () => {

  if (!selectedUser) return;

  try {

    const data = await apiFetch("control_panel/update_user_permissions.php", {
      method: "POST",
      body: JSON.stringify({
        user_id: selectedUser.id,
        permissions: userPermissions
      })
    });

    if (data.success) {

      alert("Permissions updated successfully ✅");

        setSelectedUser(null);   // close modal
        fetchUsers();            // refresh table

      } else {

        alert(data.message || "Failed to update permissions");

      }

    } catch (err) {

      console.error(err);
      alert("Server error");

    }

  };

  /* =========================
     SEARCH FILTER
  ========================== */

  const filteredUsers = users.filter((user) =>
    Object.values(user)
      .join(" ")
      .toLowerCase()
      .includes(searchTerm.toLowerCase())
  );

  // LOGS

  const [logs, setLogs] = useState<any[]>([]);

  const fetchLogs = async () => {

  const data = await apiFetch("control_panel/get_logs.php");

  if (data.success) {
    setLogs(data.logs);
  }

};

useEffect(() => {

  if (activeTab === "Logs") {
    fetchLogs();
  }

}, [activeTab]);


  // ARCHIVE USERS TAB UI

  const [archivedUsers, setArchivedUsers] = useState<any[]>([]);

  const fetchArchivedUsers = async () => {

    const data = await apiFetch("control_panel/get_archived_users.php");

    if (data.success) {
      setArchivedUsers(data.users);
    }
  };

  useEffect(() => {
  if (activeTab === "User Archives") {
    fetchArchivedUsers();
  }
}, [activeTab]);


// Restore user from archive

const restoreUser = async (id: number) => {

  await apiFetch("control_panel/restore_user.php", {
    method: "POST",
    body: JSON.stringify({ employee_id: id })
  });

  fetchArchivedUsers();
};

const deleteUser = async (id: number) => {

  const data = await apiFetch(
    `control_panel/delete_user_permanently.php?employee_id=${id}`,
    {
      method: "POST"
    }
  );

  console.log("Delete response:", data);

  if (data.success) {
    fetchArchivedUsers(); // refresh table
  } else {
    alert(data.message);
  }

};

  /* =========================
     RETURN
  ========================== */

  return (
    <div className="control-panel-layout">

      <DashboardSidebar />

      <div className="control-panel-main">
        <div className="control-panel-container">

          {/* HEADER */}
          <div className="control-panel-header">
            <h1 className="control-panel-title">Control Panel</h1>
            <p className="control-panel-subtitle">
              Manage role-based permissions
            </p>
          </div>

          {/* TABS */}
          <div className="control-panel-tabs">
            {["General", "Search", "Logs", "User Archives" ].map((tab) => (
              <button
                key={tab}
                className={`control-panel-tab ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* ================= GENERAL TAB ================= */}
          {activeTab === "General" && (
            <div className="control-panel-grid">

              {roles.map((role) => (

                <div key={role.role_id} className="control-panel-card">

                  <div className="control-panel-card-header">
                    {role.role_name}
                  </div>

                  <div className="control-panel-card-body">

                    <p className="control-panel-permission-title">
                      Permissions:
                    </p>

                    <ul>
                      {role.permissions.map((perm) => (
                        <li key={perm}>{perm}</li>
                      ))}
                    </ul>

                    <button
                      className="control-panel-permission-btn"
                      onClick={() => handleOpenRole(role)}
                    >
                      Edit Permissions
                    </button>

                  </div>

                </div>

              ))}

            </div>
          )}

          {/* ================= SEARCH TAB ================= */}
          {activeTab === "Search" && (
            <>

              <div className="control-panel-search-bar">
                <input
                  type="text"
                  placeholder="Search a User..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
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

                    {filteredUsers.map((user) => (

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

                  {archivedUsers.map((user) => (

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

                  {logs.map((log) => (

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

          {/* ================= ROLE MODAL ================= */}
          {selectedRole && (

            <div className="control-panel-modal-overlay">

              <div className="control-panel-modal">

                <h3>{selectedRole.role_name}</h3>

                <div className="control-panel-permission-list">

                  {roles
                    .flatMap((r) => r.permissions)
                    .filter((value, index, self) => self.indexOf(value) === index)
                    .map((permission) => (

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

                  <button
                    className="control-panel-cancel-btn"
                    onClick={() => setSelectedRole(null)}
                  >
                    Cancel
                  </button>

                  <button
                    className="control-panel-apply-btn"
                    onClick={handleSaveRolePermissions}
                  >
                    Save
                  </button>

                </div>

              </div>

            </div>

          )}

          {/* ================= USER PERMISSION MODAL ================= */}
          {selectedUser && (

            <div className="control-panel-modal-overlay">

              <div className="control-panel-modal">

                <h3>{selectedUser.fullName}</h3>

                <div className="control-panel-permission-list">

                  {userPermissions.map((perm) => (

                    <label key={perm.permission_id}>

                      <input
                        type="checkbox"
                        checked={perm.allowed === 1}
                        onChange={() => toggleUserPermission(perm.permission_id)}
                      />

                      {perm.permission_name}

                    </label>

                  ))}

                </div>

                <div className="control-panel-modal-actions">

                  <button
                    className="control-panel-cancel-btn"
                    onClick={() => setSelectedUser(null)}
                  >
                    Cancel
                  </button>

                  <button
                    className="control-panel-apply-btn"
                    onClick={saveUserPermissions}
                  >
                    Save
                  </button>

                </div>

              </div>

            </div>

          )}

        </div>
      </div>
    </div>
  );
};

export default ControlPanel;
