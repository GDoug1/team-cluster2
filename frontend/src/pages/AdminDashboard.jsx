import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api/api";
import DashboardSidebar from "../components/DashboardSidebar";
import MainDashboard from "./MainDashboard";
import useLiveDateTime from "../hooks/useLiveDateTime";
import useCurrentUser from "../hooks/useCurrentUser";

export default function AdminDashboard() {
  const [clusters, setClusters] = useState([]);
  const [rejectingCluster, setRejectingCluster] = useState(null);
  const [activeNav, setActiveNav] = useState("Team");
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);
  const dateTimeLabel = useLiveDateTime();
  const { user } = useCurrentUser();
  const navItems = [
    { label: "Dashboard", active: activeNav === "Dashboard", onClick: () => setActiveNav("Dashboard") },
    { label: "Team", active: activeNav === "Team", onClick: () => setActiveNav("Team") },
    { label: "Attendance" },
    { label: "Schedule" }
  ];

  const fetchClusters = useCallback(async () => {
    try {
      const data = await apiFetch("api/admin_cluster.php");
      setClusters(data);
    } catch (error) {
      console.error("Failed to load clusters", error);
    }
  }, []);

  useEffect(() => {
    fetchClusters();
    const interval = setInterval(fetchClusters, 5000);
    return () => clearInterval(interval);
  }, [fetchClusters]);

  const handleLogout = async () => {
    try {
      await apiFetch("auth/logout.php", { method: "POST" });
    } catch (error) {
      console.error("Logout failed", error);
    } finally {
      localStorage.removeItem("teamClusterUser");
      window.location.href = "/login";
    }
  };

  async function updateStatus(id, status, reason = "") {
    await apiFetch("api/approve_cluster.php", {
      method: "POST",
      body: JSON.stringify({
        cluster_id: id,
        status,
        rejection_reason: status === "rejected" ? reason : ""
      })
    });
    fetchClusters();
  }

const handleOpenRejectModal = cluster => {
    setRejectingCluster(cluster);
    setRejectionReason("");
    setRejectError("");
  };

  const handleCloseRejectModal = () => {
    setRejectingCluster(null);
    setRejectionReason("");
    setRejectError("");
  };

  const handleSubmitReject = async () => {
    const reason = rejectionReason.trim();
    if (!reason) {
      setRejectError("Please provide a reason before rejecting this team.");
      return;
    }

    if (!rejectingCluster) return;

    try {
      setIsSubmittingReject(true);
      await updateStatus(rejectingCluster.id, "rejected", reason);
      setRejectingCluster(null);
      setRejectionReason("");
      setRejectError("");
    } catch (error) {
      console.error("Failed to reject cluster", error);
      setRejectError("Unable to reject the cluster right now. Please try again.");
    } finally {
      setIsSubmittingReject(false);
    }
  };

  const formatDate = dateString => {
    if (!dateString) return "—";
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.valueOf())) return dateString;
    return parsed.toISOString().slice(0, 10);
  };

  return (
    <div className="dashboard">
      <DashboardSidebar
        avatar="AD"
        roleLabel="Admin"
        userName={user?.fullname}
        navItems={navItems}
        onLogout={handleLogout}
      />

      <main className="main">
        {activeNav === "Dashboard" ? (
          <section className="content">
            <MainDashboard />
          </section>
        ) : (
          <>
            <header className="topbar">
              <div>
                <h2>TEAM</h2>
                <div className="section-title">Admin Dashboard</div>
              </div>
              <span className="datetime">{dateTimeLabel}</span>
            </header>

            <section className="content">
              <div className="section-title">Team clusters</div>
            {clusters.length === 0 ? (
                <div className="empty-state">No team clusters available.</div>
              ) : (
                <div className="table-card">
                  <div className="table-header">
                    <div>Cluster Name</div>
                    <div>Description</div>
                    <div>Members</div>
                    <div>Created</div>
                    <div>Status</div>
                    <div>Rejection Reason</div>
                    <div>Action</div>
                  </div>
                  {clusters.map(c => (
                    <div key={c.id} className="table-row">
                      <div className="table-cell">{c.name}</div>
                      <div className="table-cell muted">{c.description}</div>
                      <div className="table-cell">{c.members ?? 0}</div>
                      <div className="table-cell">{formatDate(c.created_at)}</div>
                      <div className="table-cell">
                        <span className={`badge ${c.status}`}>{c.status}</span>
                      </div>
                      <div className="table-cell muted">
                        {c.rejection_reason || "—"}
                      </div>
                      <div className="table-cell">
                        {c.status === "pending" ? (
                          <div className="card-actions">
                            <button
                              className="btn primary"
                              onClick={() => updateStatus(c.id, "active")}
                            >
                              Accept
                            </button>
                            <button
                              className="btn secondary"
                              onClick={() => handleOpenRejectModal(c)}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="table-cell muted">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </section>
          </>
        )}
      </main>

      {rejectingCluster && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reject-modal-title">
          <div className="modal-card reject-modal-card">
            <div className="modal-header">
              <div>
                <div id="reject-modal-title" className="modal-title reject-modal-title">Reject Team Request</div>
                <div className="modal-subtitle">{rejectingCluster.name}</div>
              </div>
              <button className="btn link modal-close-btn" type="button" onClick={handleCloseRejectModal}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-text">Please share a clear reason so the team can improve and resubmit.</p>
              <label className="form-field" htmlFor="reject-reason">
                Rejection Reason
                <textarea
                  id="reject-reason"
                  rows={4}
                  value={rejectionReason}
                  onChange={event => {
                    setRejectionReason(event.target.value);
                    if (rejectError) setRejectError("");
                  }}
                  placeholder="Example: Team schedule overlaps with required on-site coverage."
                  autoFocus
                />
              </label>
              {rejectError && <div className="error">{rejectError}</div>}
              <div className="form-actions">
                <button className="btn" type="button" onClick={handleCloseRejectModal} disabled={isSubmittingReject}>
                  Cancel
                </button>
                <button className="btn danger" type="button" onClick={handleSubmitReject} disabled={isSubmittingReject}>
                  {isSubmittingReject ? "Rejecting..." : "Confirm Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}