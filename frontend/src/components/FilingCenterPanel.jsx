import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/api";
import { submitRequest } from "../api/requests";
import { useFeedback } from "./FeedbackContext";

const filingTabs = [
  { key: "leave", label: "File Leave", icon: "🗓" },
  { key: "overtime", label: "File Overtime", icon: "◷" },
  { key: "dispute", label: "Attendance Dispute", icon: "!" }
];

const getTodayDateInputValue = () => new Date().toISOString().slice(0, 10);
const getTomorrowDateInputValue = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().slice(0, 10);
};

export default function FilingCenterPanel({ onSubmitted = null, initialTab = "leave", initialDate = "" }) {
  const { confirm } = useFeedback();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [clusterInfo, setClusterInfo] = useState(null);
  const [disputeType, setDisputeType] = useState("Forget Time In/Out");
  const [leaveType, setLeaveType] = useState("Sick Leave");
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [otType, setOtType] = useState("Regular Overtime");
  const [overtimeDate, setOvertimeDate] = useState("");
  const [overtimeStart, setOvertimeStart] = useState("");
  const [overtimeEnd, setOvertimeEnd] = useState("");
  const [disputeDate, setDisputeDate] = useState(initialDate);
  const [reason, setReason] = useState("");
  const [leavePhoto, setLeavePhoto] = useState(null);
  const [leavePhotoInputKey, setLeavePhotoInputKey] = useState(0);
  const [message, setMessage] = useState("");
  const [agreementAccuracy, setAgreementAccuracy] = useState(false);
  const [agreementFraud, setAgreementFraud] = useState(false);
  const [submitting, setSubmitting] = useState(false);


  useEffect(() => {
    setActiveTab(initialTab);
    if (initialDate) {
      setDisputeDate(initialDate);
    }
  }, [initialTab, initialDate]);

  useEffect(() => {
    // Fetch cluster info to show context
    const fetchClusterContext = async () => {
      try {
        const data = await apiFetch("api/employee/employee_clusters.php");
        if (Array.isArray(data) && data.length > 0) {
          setClusterInfo(data[0]);
        }
      } catch (error) {
        console.error("Failed to load cluster context:", error);
      }
    };
    fetchClusterContext();
  }, []);

  const todayDate = useMemo(() => getTodayDateInputValue(), []);
  const tomorrowDate = useMemo(() => getTomorrowDateInputValue(), []);

  const panelTitle = useMemo(() => {
    if (activeTab === "leave") return "New Leave Request";
    if (activeTab === "overtime") return "New Overtime Request";
    return "New Dispute Request";
  }, [activeTab]);

  const resetForm = () => {
    setReason("");
    setLeaveStartDate("");
    setLeaveEndDate("");
    setOvertimeDate("");
    setOvertimeStart("");
    setOvertimeEnd("");
    setDisputeDate("");
    setLeavePhoto(null);
    setLeavePhotoInputKey(prev => prev + 1);
    setAgreementAccuracy(false);
    setAgreementFraud(false);
  };

  const handleSubmit = async () => {
    if (submitting || !agreementAccuracy || !agreementFraud) return;
    setMessage("");

    const hasConfirmedSubmission = await confirm({
      title: "Submit request?",
      message: "Please confirm that you want to submit this request.",
      confirmLabel: "Submit"
    });
    if (!hasConfirmedSubmission) return;

    try {
      setSubmitting(true);
      if (activeTab === "leave") {
        if (!leavePhoto) {
          throw { error: "Upload photo is required before submitting a leave request." };
        }
        if (leaveStartDate < todayDate || leaveEndDate < todayDate) {
          throw { error: "Leave dates cannot be earlier than today." };
        }
        if (leaveEndDate < leaveStartDate) {
          throw { error: "Leave end date cannot be earlier than the start date." };
        }

        const payload = new FormData();
        payload.append("type", "leave");
        payload.append("leaveType", leaveType);
        payload.append("startDate", leaveStartDate);
        payload.append("endDate", leaveEndDate);
        payload.append("reason", reason);
        if (leavePhoto) {
          payload.append("photo", leavePhoto);
        }

        await submitRequest(payload);
      } else if (activeTab === "overtime") {
        if (overtimeDate < tomorrowDate) {
          throw { error: "Overtime requests must be filed for a future date." };
        }

        await submitRequest({
          type: "overtime",
          otType,
          date: overtimeDate,
          startTime: overtimeStart,
          endTime: overtimeEnd,
          reason
        });
      } else {
        if (disputeDate < todayDate) {
          throw { error: "Dispute dates cannot be earlier than today." };
        }

        await submitRequest({
          type: "dispute",
          disputeDate,
          disputeType,
          reason
        });
      }

      setMessage("Request submitted successfully.");
      resetForm();
      if (typeof onSubmitted === "function") {
        onSubmitted();
      }
    } catch (error) {
      setMessage(error?.error ?? "Unable to submit request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="filing-center-layout">
      <div className="filing-center-header">
        <h2>Filing Center</h2>
        <p>Submit your attendance-related requests here.</p>
      </div>

      <div className="filing-center-shell">
        <nav className="filing-center-tabs" aria-label="Filing request types" role="tablist">
          {filingTabs.map(tab => (
            <button
              key={tab.key}
              type="button"
              id={`tab-${tab.key}`}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`panel-${tab.key}`}
              className={`filing-center-tab${activeTab === tab.key ? " is-active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span className="tab-icon" aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <section
          className="filing-center-panel"
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
        >
          <header className="filing-center-panel-header">{panelTitle}</header>

          <div className="filing-center-panel-body">
            {clusterInfo && (
              <div className="filing-context-banner" role="status">
                Filing as member of <strong>{clusterInfo.cluster_name || "Unknown Cluster"}</strong> under Coach <strong>{clusterInfo.coach_name || "Unknown Coach"}</strong>
              </div>
            )}
            {activeTab === "leave" && (
              <>
                <div className="filing-field filing-field-full">
                  <label htmlFor="leave-type">Leave Type</label>
                  <select id="leave-type" value={leaveType} onChange={event => setLeaveType(event.target.value)}>
                    <option>Sick Leave</option>
                    <option>Vacation Leave</option>
                    <option>Emergency Leave</option>
                  </select>
                </div>

                <div className="filing-grid-two">
                  <div className="filing-field">
                    <label htmlFor="leave-start">Start Date</label>
                    <input id="leave-start" type="date" min={todayDate} value={leaveStartDate} onChange={event => setLeaveStartDate(event.target.value)} />
                  </div>
                  <div className="filing-field">
                    <label htmlFor="leave-end">End Date</label>
                    <input id="leave-end" type="date" min={leaveStartDate || todayDate} value={leaveEndDate} onChange={event => setLeaveEndDate(event.target.value)} />
                  </div>
                </div>
                <div className="filing-grid-two">
                  <div className="filing-field filing-field-full">
                    <label htmlFor="leave-photo">Upload Photo</label>
                    <input
                      id="leave-photo"
                      key={leavePhotoInputKey}
                      type="file"
                      accept="image/*"
                      required
                      aria-describedby="photo-help"
                      onChange={event => setLeavePhoto(event.target.files?.[0] ?? null)}
                    />
                    <small id="photo-help" className="filing-field-help">
                      Upload a supporting photo before you can submit a leave request.
                      {leavePhoto ? ` Selected: ${leavePhoto.name}` : ""}
                    </small>
                  </div>
                </div>
              </>
            )}

            {activeTab === "overtime" && (
              <>
                <div className="filing-warning" role="alert">
                  Overtime requests must be filed for a future date. Same-day filing is not permitted to allow for prior approval by your supervisor.
                </div>
                <div className="filing-field filing-field-full">
                  <label htmlFor="ot-type">Overtime Type</label>
                  <select id="ot-type" value={otType} onChange={event => setOtType(event.target.value)}>
                    <option>Regular Overtime</option>
                    <option>Duty on Rest Day</option>
                    <option>Duty on Rest Day OT</option>
                  </select>
                </div>
                <div className="filing-grid-three">
                  <div className="filing-field">
                    <label htmlFor="ot-date">Date</label>
                    <input id="ot-date" type="date" min={tomorrowDate} value={overtimeDate} onChange={event => setOvertimeDate(event.target.value)} />
                  </div>
                  <div className="filing-field">
                    <label htmlFor="ot-start">Start Time</label>
                    <input id="ot-start" type="time" value={overtimeStart} onChange={event => setOvertimeStart(event.target.value)} />
                  </div>
                  <div className="filing-field">
                    <label htmlFor="ot-end">End Time</label>
                    <input id="ot-end" type="time" value={overtimeEnd} onChange={event => setOvertimeEnd(event.target.value)} />
                  </div>
                </div>
              </>
            )}

            {activeTab === "dispute" && (
              <div className="filing-grid-two">
                <div className="filing-field">
                  <label htmlFor="dispute-date">Dispute Date</label>
                  <input id="dispute-date" type="date" min={todayDate} value={disputeDate} onChange={event => setDisputeDate(event.target.value)} />
                </div>
                <div className="filing-field">
                  <label htmlFor="dispute-type">Dispute Type</label>
                  <select id="dispute-type" value={disputeType} onChange={event => setDisputeType(event.target.value)}>
                    <option>Forget Time In/Out</option>
                    <option>System Error</option>
                    <option>Official Business</option>
                    <option>Incorrect Status</option>
                    <option>Breaktime/Lunch</option>
                  </select>
                </div>
              </div>
            )}

            <div className="filing-field filing-field-full">
              <label htmlFor="filing-reason">Reason / Justification</label>
              <textarea id="filing-reason" value={reason} onChange={event => setReason(event.target.value)} placeholder="Provide a detailed explanation for your request..." rows={4} />
            </div>

            <div className="filing-agreement-container">
              <label className="filing-agreement" htmlFor="agreement-accuracy">
                <input
                  id="agreement-accuracy"
                  type="checkbox"
                  checked={agreementAccuracy}
                  onChange={event => setAgreementAccuracy(event.target.checked)}
                />
                <span>I confirm that the information submitted has undergone a thorough double-check process, ensuring its accuracy and reliability to the best of my knowledge and abilities</span>
              </label>
              <label className="filing-agreement" htmlFor="agreement-fraud" style={{ marginTop: "12px" }}>
                <input
                  id="agreement-fraud"
                  type="checkbox"
                  checked={agreementFraud}
                  onChange={event => setAgreementFraud(event.target.checked)}
                />
                <span>I understand that falsifying information is a serious offense, constituting fraud, and I acknowledge that engaging in such behavior can lead to severe consequences, including termination of employment</span>
              </label>
            </div>

            {message ? <div className="form-hint">{message}</div> : null}
            <button
              type="button"
              className="filing-submit-btn"
              onClick={handleSubmit}
              disabled={submitting || !agreementAccuracy || !agreementFraud}
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}