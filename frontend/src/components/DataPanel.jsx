import { useMemo, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { normalizeAttendanceHistoryRecord } from "../api/attendance";
import { formatDateTime } from "../utils/dateUtils";
import { useFeedback } from "./FeedbackContext";
import UnifiedTable from "./shared/UnifiedTable";

const normalizeRequestDetails = value => {
  const text = String(value ?? "").trim();
  return text || "—";
};

const resolveRequestPhotoUrl = value => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost/team-cluster2/backend").replace(/\/$/, "");
  return `${baseUrl}/${text.replace(/^\/+/, "")}`;
};

const toDateInputValue = value => {
  if (!value) return null;
  const str = String(value).trim();
  if (str.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const parsed = new Date(str.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPersonPrimaryValue = (item, personField) => {
  if (!personField) return "—";
  return item[personField] ?? "—";
};

const getPersonSecondaryValue = (item, personField) => {
  if (!personField) return null;
  if (personField === "employee_name") return item.employee_username || null;
  if (personField === "username") return item.user_name || null;
  return null;
};

const formatAttendanceDate = (value) => {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T"));
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

const formatAttendanceTime = (value) => {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T"));
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
};

const panelConfig = {
  attendance: {
    title: "My Attendance Logs",
    filterLabel: "Filter Dates",
    searchPlaceholder: "Search...",
    columns: ["Date", "Time In", "Time Out", "Break In", "Break Out", "Total Hours", "Status", "Actions"],
    messageTitle: "Server Connection Lost",
    messageSubtitle: "Attendance logs cannot be retrieved at this moment."
  },
  requests: {
    title: "My Requests",
    filterLabel: "Filter Type",
    searchPlaceholder: "Search requests, reasons, status...",
    columns: ["Date Filed", "Filed By", "Request Type", "Details", "Schedule / Period", "Status", "Endorsed By", "Approved By", "Actions"],
    messageTitle: "Unable to load requests",
    messageSubtitle: "Please try again in a few moments."
  }
};

const getStatusColor = (status) => {
  const s = String(status).toLowerCase();
  if (['present', 'approved', 'on time', 'complete'].includes(s)) return '#52c41a';
  if (['absent', 'denied', 'rejected'].includes(s)) return '#f5222d';
  if (s === 'late') return '#faad14';
  if (s === 'pending') return '#1890ff';
  return '#cbd5e1';
};

export default function DataPanel({
  type = "attendance",
  records = [],
  personField = null,
  personLabel = "Person",
  onEditRow = null,
  externalDateFilter = null,
  onExternalDateFilterChange = null,
  onRequestAction = null,
  requestActionLoadingId = "",
  requestActions = null,
  enableRequestFilters = false,
  loading = false,
  error = null,
}) {
  const { confirm } = useFeedback();
  const config = panelConfig[type] ?? panelConfig.attendance;
  const resolvedRequestActions = Array.isArray(requestActions) && requestActions.length > 0
    ? requestActions
    : [
      { label: "Endorse", status: "Approved", variant: "am-action-btn primary", allowedStatuses: ["pending"] },
      { label: "Reject", status: "Rejected", variant: "am-action-btn secondary", allowedStatuses: ["pending"] }
    ];

  const [searchQuery, setSearchQuery] = useState("");
  const [dateStartFilter, setDateStartFilter] = useState("");
  const [dateEndFilter, setDateEndFilter] = useState("");
  const [requestTypeFilter, setRequestTypeFilter] = useState("all");
  const [requestStatusFilter, setRequestStatusFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [rowsPerPageInput, setRowsPerPageInput] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState(type === "attendance" ? "Date" : "Date Filed");
  const [sortDirection, setSortDirection] = useState("desc");

  const handleSort = key => {
    if (sortKey === key) {
      setSortDirection(current => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const getSortValue = useCallback((item, key) => {
    if (type === "attendance") {
      if (key === "Date") return new Date(item.time_in_at ?? item.time_out_at ?? 0).getTime();
      if (key === "Time In") return new Date(item.time_in_at ?? 0).getTime();
      if (key === "Time Out") return new Date(item.time_out_at ?? 0).getTime();
      if (key === "Total Hours") return Number(normalizeAttendanceHistoryRecord(item).total_hours || 0);
      if (key === "Status") return String(item.attendance_tag ?? item.tag ?? "").toLowerCase();
      if (key === "Cluster") return String(item.cluster_name ?? "").toLowerCase();
      if (key === "person") return String(item[personField] ?? "").toLowerCase();
      return String(item[key.toLowerCase().replace(/ /g, "_")] ?? "").toLowerCase();
    }
    if (type === "requests") {
      if (key === "Date Filed") return new Date(item.date_filed ?? 0).getTime();
      if (key === "person") return String(item[personField] ?? "").toLowerCase();
      if (key === "Status") return String(item.status ?? "").toLowerCase();
      if (key === "Request Type") return String(item.request_type ?? "").toLowerCase();
      return String(item[key.toLowerCase().replace(/ /g, "_")] ?? "").toLowerCase();
    }
    return "";
  }, [type, personField]);

  const handleActionClick = async (item, action) => {
    if (!onRequestAction) return;

    const isApproval = action.status === "Approved" || action.status === "Endorsed";
    const isDenial =
      action.status.toLowerCase().includes("reject") ||
      action.status.toLowerCase().includes("denied") ||
      action.status.toLowerCase().includes("decline");

    const hasConfirmedAction = await confirm({
      title: isApproval ? `Confirm ${action.label}` : isDenial ? `Confirm ${action.label}` : "Confirm request action",
      message: `Are you sure you want to ${action.label.toLowerCase()} this request?`,
      confirmLabel: action.label,
      variant: isDenial ? "danger" : "primary"
    });
    if (!hasConfirmedAction) return;

    onRequestAction(item, action.status);
  };

  const requestTypeOptions = useMemo(() => ([
    "all",
    "Forget Time In/Out",
    "System Error",
    "Official Business",
    "Incorrect Status",
    "Breaktime/Lunch",
    "Sick Leave",
    "Emergency Leave",
    "Vacation Leave",
    "Regular Overtime",
    "Duty on Rest Day",
    "Duty on Rest Day OT"
  ]), []);

  const requestStatusOptions = useMemo(() => ([
    "all",
    ...new Set(records.map(item => String(item.status ?? "").trim()).filter(Boolean))
  ]), [records]);

  const filteredAndSortedRecords = useMemo(() => {
    let result = [];
    if (type === "requests") {
      result = records.filter(item => {
        const entryDate = toDateInputValue(item.date_filed);
        
        if (externalDateFilter) {
          if (!entryDate || entryDate !== externalDateFilter) return false;
        } else {
          if (dateStartFilter && (!entryDate || entryDate < dateStartFilter)) return false;
          if (dateEndFilter && (!entryDate || entryDate > dateEndFilter)) return false;
        }

        const normalizedRequestType = String(item.request_type ?? "").trim().toLowerCase();
        const normalizedStatus = String(item.status ?? "").trim().toLowerCase();

        if (enableRequestFilters && requestTypeFilter !== "all" && normalizedRequestType !== requestTypeFilter.toLowerCase()) return false;
        if (enableRequestFilters && requestStatusFilter !== "all" && normalizedStatus !== requestStatusFilter.toLowerCase()) return false;

        const haystack = [
          item.request_type,
          item.details,
          item.status,
          item.schedule_period,
          item.employee_name,
          item.employee_username,
          item.username,
          item.user_name,
          item.request_action_by_name,
          item.request_action_by_role,
          item.request_action_at
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return !searchQuery || haystack.includes(searchQuery.toLowerCase());
      });
    } else if (type === "attendance") {
      result = records.filter(item => {
        const entryDate = toDateInputValue(item.time_in_at ?? item.time_out_at ?? item.updated_at ?? item.attendance_updated_at);
        if (dateStartFilter && (!entryDate || entryDate < dateStartFilter)) return false;
        if (dateEndFilter && (!entryDate || entryDate > dateEndFilter)) return false;
        if (externalDateFilter && (!entryDate || entryDate !== externalDateFilter)) return false;

        const haystack = [
          item.cluster_name,
          item.attendance_tag,
          item.tag,
          item.attendance_note,
          item.note,
          item.employee_username,
          item.username,
          personField ? item[personField] : "",
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (searchQuery && !haystack.includes(searchQuery.toLowerCase())) return false;
        return true;
      });
    }

    if (sortKey) {
      result.sort((a, b) => {
        const valA = getSortValue(a, sortKey);
        const valB = getSortValue(b, sortKey);
        const multiplier = sortDirection === "asc" ? 1 : -1;

        if (typeof valA === "number" && typeof valB === "number") {
          return (valA - valB) * multiplier;
        }
        return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: "base" }) * multiplier;
      });
    }

    return result;
  }, [type, records, dateStartFilter, dateEndFilter, externalDateFilter, searchQuery, personField, enableRequestFilters, requestTypeFilter, requestStatusFilter, sortKey, sortDirection, getSortValue]);

  const rowsPerPage = parseInt(rowsPerPageInput) || 10;
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRecords.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * rowsPerPage;
  const paginatedRecords = filteredAndSortedRecords.slice(pageStartIndex, pageStartIndex + rowsPerPage);

  const handleClearFilters = () => {
    setSearchQuery("");
    setDateStartFilter("");
    setDateEndFilter("");
    setRequestTypeFilter("all");
    setRequestStatusFilter("all");
    if (typeof onExternalDateFilterChange === "function") {
      onExternalDateFilterChange("");
    }
    setCurrentPage(1);
  };

  const columns = useMemo(() => {
    if (type === "attendance") {
      return [
        { label: "Date", key: "date", sortable: true },
        { label: "Time In", key: "time_in", sortable: true },
        { label: "Time Out", key: "time_out", sortable: true },
        { label: "Total Hours", key: "total_hours", sortable: true },
        { label: "Status", key: "status", sortable: true },
        { label: "Cluster", key: "cluster", sortable: true },
        { label: "Note", key: "note", sortable: false, expandable: true },
        ...(personField ? [{ label: personLabel, key: "person", sortable: true }] : []),
      ];
    }
    if (type === "requests") {
      return [
        { label: "Date Filed", key: "date_filed", sortable: true },
        ...(personField ? [{ label: "Filed By", key: "person", sortable: true }] : []),
        { label: "Request Type", key: "request_type", sortable: true },
        { label: "Details", key: "details", sortable: false, expandable: true },
        { label: "Schedule / Period", key: "schedule_period", sortable: false },
        { label: "Status", key: "status", sortable: true },
        { label: "Endorsed By", key: "endorsed_by", sortable: true },
        { label: "Approved By", key: "approved_by", sortable: true },
      ];
    }
    return [];
  }, [type, personField, personLabel]);

  const renderCell = useCallback((item, key) => {
    if (type === "attendance") {
      const normalizedAttendance = normalizeAttendanceHistoryRecord(item);
      const attendanceDateValue = item.time_in_at ?? item.time_out_at ?? item.updated_at ?? item.attendance_updated_at;
      const statusText = item.attendance_tag ?? item.tag ?? "Pending";

      switch (key) {
        case 'date': return formatAttendanceDate(attendanceDateValue);
        case 'time_in': return formatAttendanceTime(item.time_in_at);
        case 'time_out': return formatAttendanceTime(item.time_out_at);
        case 'total_hours': return `${normalizedAttendance.total_hours}h`;
        case 'status':
          return (
            <div className="am-status-cell">
              <div className="am-status-dot" style={{ backgroundColor: getStatusColor(statusText) }} />
              <span className="am-status-text">{statusText}</span>
            </div>
          );
        case 'cluster': return item.cluster_name ?? "—";
        case 'note': return item.attendance_note ?? item.note ?? "—";
        case 'person':
          return (
            <div className="team-attendance-employee-cell">
              <span>{getPersonPrimaryValue(item, personField)}</span>
              {getPersonSecondaryValue(item, personField) && <small>{getPersonSecondaryValue(item, personField)}</small>}
            </div>
          );
        default: return "—";
      }
    }
    if (type === "requests") {
      switch (key) {
        case 'date_filed': return formatDateTime(item.date_filed);
        case 'person':
          return (
            <div className="team-attendance-employee-cell">
              <span>{getPersonPrimaryValue(item, personField)}</span>
              {getPersonSecondaryValue(item, personField) && <small>{getPersonSecondaryValue(item, personField)}</small>}
            </div>
          );
        case 'request_type': return item.request_type ?? "—";
        case 'details': return normalizeRequestDetails(item.details);
        case 'schedule_period': return item.schedule_period ?? "—";
        case 'status': return item.status ?? "Pending";
        case 'endorsed_by': return item.endorsed_by_name || "—";
        case 'approved_by': return item.approved_by_name || "—";
        default: return "—";
      }
    }
    return "—";
  }, [type, personField]);

  const renderActions = useCallback((item) => {
    if (type === "attendance") {
      if (!onEditRow) return null;
      return (
        <button
          className="am-action-btn primary"
          type="button"
          onClick={() => onEditRow(item)}
        >
          Edit
        </button>
      );
    }
    if (type === "requests") {
      return (
        <div className="am-table-actions-cell">
          <button
            className="am-action-btn primary"
            type="button"
            onClick={() => setSelectedRequest(item)}
          >
            View
          </button>
          {onRequestAction && resolvedRequestActions.map(action => {
            const currentStatus = String(item.status ?? "").toLowerCase();
            const allowedStatuses = Array.isArray(action.allowedStatuses)
              ? action.allowedStatuses.map(value => String(value).toLowerCase())
              : ["pending"];
            const canReview = item.can_review !== false;
            const isVisible = typeof action.isVisible === "function" ? action.isVisible(item) : true;
            const isEnabled = isVisible && canReview && allowedStatuses.some(status => currentStatus.includes(status));

            if (!isVisible) return null;

            return (
              <button
                key={`${item.id}-${action.status}`}
                className={action.variant ?? "am-action-btn primary"}
                type="button"
                disabled={requestActionLoadingId === item.id || !isEnabled}
                onClick={() => handleActionClick(item, action)}
              >
                {requestActionLoadingId === item.id ? "…" : action.label}
              </button>
            );
          })}
        </div>
      );
    }
    return null;
  }, [type, onEditRow, onRequestAction, resolvedRequestActions, requestActionLoadingId, handleActionClick]);

  const extraFilters = useMemo(() => {
    if (type === "requests" && enableRequestFilters) {
      return (
        <>
          <label className="am-filter-field">
            <span className="am-filter-label">Type</span>
            <select
              style={{ padding: '6px', fontSize: '13px', borderRadius: '2px', border: '1px solid #d9d9d9', height: '36px' }}
              value={requestTypeFilter}
              onChange={e => { setRequestTypeFilter(e.target.value); setCurrentPage(1); }}
            >
              {requestTypeOptions.map(opt => <option key={opt} value={opt}>{opt === 'all' ? 'All Types' : opt}</option>)}
            </select>
          </label>
          <label className="am-filter-field">
            <span className="am-filter-label">Status</span>
            <select
              style={{ padding: '6px', fontSize: '13px', borderRadius: '2px', border: '1px solid #d9d9d9', height: '36px' }}
              value={requestStatusFilter}
              onChange={e => { setRequestStatusFilter(e.target.value); setCurrentPage(1); }}
            >
              {requestStatusOptions.map(opt => <option key={opt} value={opt}>{opt === 'all' ? 'All Status' : opt}</option>)}
            </select>
          </label>
        </>
      );
    }
    if (type === "attendance" && typeof onExternalDateFilterChange === "function") {
       return (
        <label className="am-filter-field">
          <span className="am-filter-label">Single Date</span>
          <input 
            type="date" 
            value={externalDateFilter ?? ""} 
            onChange={e => { onExternalDateFilterChange(e.target.value); setCurrentPage(1); }} 
          />
        </label>
       );
    }
    return null;
  }, [type, enableRequestFilters, requestTypeFilter, requestTypeOptions, requestStatusFilter, requestStatusOptions, externalDateFilter, onExternalDateFilterChange]);

  const gridTemplateColumns = useMemo(() => {
    if (type === "attendance") {
      // Columns: Date, Time In, Time Out, Total Hours, Status, Cluster, Note, [Person] + Actions
      const dateCol = "minmax(150px, 1.2fr) ";
      const timeCols = "minmax(110px, 1fr) minmax(110px, 1fr) ";
      const hoursCol = "minmax(100px, 0.8fr) ";
      const statusCol = "minmax(130px, 1fr) ";
      const clusterCol = "minmax(140px, 1fr) ";
      const noteCol = "minmax(200px, 1.5fr) ";
      const personCol = personField ? "minmax(150px, 1fr) " : "";
      const actionsCol = "minmax(100px, 0.8fr)";
      return `${dateCol}${timeCols}${hoursCol}${statusCol}${clusterCol}${noteCol}${personCol}${actionsCol}`;
    }
    if (type === "requests") {
      // Columns: Date Filed, [Filed By], Request Type, Details, Schedule/Period, Status, Endorsed By, Approved By + Actions
      const dateCol = "minmax(170px, 1.2fr) ";
      const personCol = personField ? "minmax(140px, 1fr) " : "";
      const typeCol = "minmax(160px, 1fr) ";
      const detailsCol = "minmax(180px, 1.5fr) ";
      const schedCol = "minmax(130px, 1fr) ";
      const statusCol = "minmax(120px, 1fr) ";
      const endorsedCol = "minmax(140px, 1fr) ";
      const approvedCol = "minmax(140px, 1fr) ";
      const actionsCol = "minmax(180px, 1fr)";
      return `${dateCol}${personCol}${typeCol}${detailsCol}${schedCol}${statusCol}${endorsedCol}${approvedCol}${actionsCol}`;
    }
    return "";
  }, [type, personField]);

    return (
      <>
        <UnifiedTable
          title={type === "attendance" ? "All Attendance" : (onRequestAction ? "File Requests" : "My Requests")}
          columns={columns}
          data={paginatedRecords}
          totalRecords={filteredAndSortedRecords.length}
          loading={loading}
          error={error}
          currentPage={safeCurrentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          rowsPerPage={rowsPerPageInput}
          onRowsPerPageChange={val => { setRowsPerPageInput(val); setCurrentPage(1); }}
          searchQuery={searchQuery}
          onSearchChange={val => { setSearchQuery(val); setCurrentPage(1); }}
          dateStart={dateStartFilter}
          onDateStartChange={val => { setDateStartFilter(val); setCurrentPage(1); }}
          dateEnd={dateEndFilter}
          onDateEndChange={val => { setDateEndFilter(val); setCurrentPage(1); }}
          onClearFilters={handleClearFilters}
          extraFilters={extraFilters}
          sortKey={sortKey}
          sortDirection={sortDirection}
          onSort={handleSort}
          renderCell={renderCell}
          renderActions={renderActions}
          gridTemplateColumns={gridTemplateColumns}
        />

        {selectedRequest && (
          <div className="modal-overlay request-details-overlay" role="presentation" onClick={() => setSelectedRequest(null)}>
            <div
              className="modal-card request-details-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="request-details-modal-title"
              onClick={event => event.stopPropagation()}
            >
              <div className="modal-header request-details-modal-header">
                <div className="request-details-modal-heading">
                  <div id="request-details-modal-title" className="modal-title request-details-modal-title">Request Details</div>
                  <p className="modal-text request-details-modal-subtitle">
                    {selectedRequest.request_type ?? "Request"} filed on {formatDateTime(selectedRequest.date_filed)}
                  </p>
                </div>
                <button
                  className="icon-btn request-details-close-btn"
                  type="button"
                  aria-label="Close request details"
                  onClick={() => setSelectedRequest(null)}
                >
                  ✕
                </button>
              </div>
              <div className="request-details-modal-body">
                <div className="request-details-content">
                  {normalizeRequestDetails(selectedRequest.details)}
                </div>
                {resolveRequestPhotoUrl(selectedRequest.photo_url ?? selectedRequest.photo_path) ? (
                  <div className="request-details-photo-section">
                    <div className="request-details-photo-label">Supporting Photo</div>
                    <a
                      className="request-details-photo-link"
                      href={resolveRequestPhotoUrl(selectedRequest.photo_url ?? selectedRequest.photo_path)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open photo in new tab
                    </a>
                    <img
                      className="request-details-photo-preview"
                      src={resolveRequestPhotoUrl(selectedRequest.photo_url ?? selectedRequest.photo_path)}
                      alt={`${selectedRequest.request_type ?? "Request"} supporting upload`}
                    />
                  </div>
                ) : null}
              </div>
              <div className="modal-actions request-details-modal-actions">
                <button className="btn" type="button" onClick={() => setSelectedRequest(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="offline-data-panel" role="region" aria-label={`${config.title} offline view`}>
      <div className="offline-data-panel-header">
        <div className="offline-data-panel-title-wrap">
          <h3 className="offline-data-panel-title">{config.title}</h3>
          <span className="offline-pill">OFFLINE</span>
        </div>
        <div className="offline-data-panel-controls">
          <button type="button" className="offline-control-btn" disabled>{config.filterLabel}</button>
          <div className="offline-search-input" aria-hidden="true">{config.searchPlaceholder}</div>
        </div>
      </div>

      <div className={`offline-data-table offline-data-table-${type}`} role="table" aria-label={config.title}>
        <div className="offline-data-table-header" role="row">
          {config.columns.map(column => (
            <span key={column} role="columnheader">{column}</span>
          ))}
        </div>
        <div className="offline-data-table-empty" role="row">
          <div className="offline-data-empty-icon" aria-hidden="true">☰</div>
          <p className="offline-data-empty-title">{config.messageTitle}</p>
          <p className="offline-data-empty-subtitle">{config.messageSubtitle}</p>
        </div>
      </div>
    </div>
  );
}