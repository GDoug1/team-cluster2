import { useMemo, useState } from "react";

const normalizeRequestDetails = value => {
  const text = String(value ?? "").trim();
  return text || "—";
};

const truncateRequestDetails = (value, maxLength = 72) => {
  const details = normalizeRequestDetails(value);
  if (details === "—" || details.length <= maxLength) return details;
  return `${details.slice(0, maxLength).trimEnd()}…`;
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
    columns: ["Date Filed", "Request Type", "Details", "Schedule / Period", "Status", "Actions"],
    messageTitle: "Unable to load requests",
    messageSubtitle: "Please try again in a few moments."
  }
};

const formatDateTimeLabel = value => {
  if (!value) return "—";
  const date = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
};

const toDateInputValue = value => {
  if (!value) return null;
  const parsed = new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getFullYear();
  const month = `${parsed.getMonth() + 1}`.padStart(2, "0");
  const day = `${parsed.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
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
}) {
  const config = panelConfig[type] ?? panelConfig.attendance;
  const resolvedRequestActions = Array.isArray(requestActions) && requestActions.length > 0
    ? requestActions
    : [
      { label: "Endorse", status: "Approved", variant: "btn", allowedStatuses: ["pending"] },
      { label: "Reject", status: "Rejected", variant: "btn secondary", allowedStatuses: ["pending"] }
    ];
  const [searchQuery, setSearchQuery] = useState("");
  const [dateStartFilter, setDateStartFilter] = useState("");
  const [dateEndFilter, setDateEndFilter] = useState("");
  const [requestTypeFilter, setRequestTypeFilter] = useState("all");
  const [requestStatusFilter, setRequestStatusFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState(null);

  const requestTypeOptions = useMemo(() => ([
    "all",
    ...new Set(records.map(item => String(item.request_type ?? "").trim()).filter(Boolean))
  ]), [records]);

  const requestStatusOptions = useMemo(() => ([
    "all",
    ...new Set(records.map(item => String(item.status ?? "").trim()).filter(Boolean))
  ]), [records]);

  const filteredRecords = useMemo(() => {
    if (type === "requests") {
      return records.filter(item => {
        const normalizedRequestType = String(item.request_type ?? "").trim().toLowerCase();
        const normalizedStatus = String(item.status ?? "").trim().toLowerCase();

        if (enableRequestFilters && requestTypeFilter !== "all" && normalizedRequestType !== requestTypeFilter.toLowerCase()) return false;
        if (enableRequestFilters && requestStatusFilter !== "all" && normalizedStatus !== requestStatusFilter.toLowerCase()) return false;

        const haystack = [item.request_type, item.details, item.status, item.schedule_period]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return !searchQuery || haystack.includes(searchQuery.toLowerCase());
      });
    }

    if (type !== "attendance") return [];

    return records.filter(item => {
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
        personField ? item[personField] : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (searchQuery && !haystack.includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [type, records, dateStartFilter, dateEndFilter, externalDateFilter, searchQuery, personField, enableRequestFilters, requestTypeFilter, requestStatusFilter]);

  if (type === "attendance") {
    const attendanceColumnCount = 6 + (personField ? 1 : 0) + (onEditRow ? 1 : 0);
    const attendanceGridStyle = {
      gridTemplateColumns: `repeat(${attendanceColumnCount}, minmax(140px, 1fr))`,
      minWidth: `${attendanceColumnCount * 140}px`
    };

    return (
      <div className="employee-attendance-history-table" role="table" aria-label={config.title}>
        <div className="attendance-history-range-filter" role="group" aria-label="Filter attendance history">
          <label className="attendance-history-filter">
            <span>From</span>
            <input type="date" value={dateStartFilter} onChange={event => setDateStartFilter(event.target.value)} />
          </label>
          <label className="attendance-history-filter">
            <span>To</span>
            <input type="date" value={dateEndFilter} onChange={event => setDateEndFilter(event.target.value)} />
          </label>
          {typeof onExternalDateFilterChange === "function" && (
            <label className="attendance-history-filter">
              <span>Date</span>
              <input type="date" value={externalDateFilter ?? ""} onChange={event => onExternalDateFilterChange(event.target.value)} />
            </label>
          )}
          <label className="attendance-history-filter" style={{ minWidth: "260px" }}>
            <span>Search</span>
            <input type="text" value={searchQuery} placeholder={config.searchPlaceholder} onChange={event => setSearchQuery(event.target.value)} />
          </label>
        </div>

        <div className="employee-attendance-history-scroll">
          <div className="employee-attendance-history-header" role="row" style={attendanceGridStyle}>
            <span role="columnheader">Date</span>
            <span role="columnheader">Time In</span>
            <span role="columnheader">Time Out</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Cluster</span>
            <span role="columnheader">Note</span>
            {personField && <span role="columnheader">{personLabel}</span>}
            {onEditRow && <span role="columnheader">Action</span>}
          </div>
        {filteredRecords.length > 0 ? filteredRecords.map(item => (
            <div
              key={`${item.id ?? item.attendance_id}-${item.updated_at ?? item.attendance_updated_at ?? item.time_in_at ?? "entry"}`}
              className="employee-attendance-history-row"
              role="row"
              style={attendanceGridStyle}
            >
              <span role="cell">{formatDateTimeLabel(item.time_in_at ?? item.time_out_at ?? item.updated_at ?? item.attendance_updated_at)}</span>
              <span role="cell">{formatDateTimeLabel(item.time_in_at)}</span>
              <span role="cell">{formatDateTimeLabel(item.time_out_at)}</span>
              <span role="cell">{item.attendance_tag ?? item.tag ?? "Pending"}</span>
              <span role="cell">{item.cluster_name ?? "—"}</span>
              <span role="cell">{item.attendance_note ?? item.note ?? "—"}</span>
              {personField && <span role="cell">{item[personField] ?? "—"}</span>}
              {onEditRow && (
                <span role="cell">
                  <button className="btn" type="button" onClick={() => onEditRow(item)}>Edit</button>
                </span>
              )}
            </div>
          )) : (
            <div className="empty-state">No attendance records match the selected filters.</div>
          )}
        </div>
      </div>
    );
  }

  if (type === "requests") {
    return (
      <div className="employee-attendance-history-table" role="table" aria-label={config.title}>
        <div className="attendance-history-range-filter" role="group" aria-label="Filter requests">
          {enableRequestFilters && (
            <>
              <label className="attendance-history-filter">
                <span>Request Type</span>
                <select value={requestTypeFilter} onChange={event => setRequestTypeFilter(event.target.value)}>
                  {requestTypeOptions.map(option => (
                    <option key={option} value={option}>
                      {option === "all" ? "All request types" : option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="attendance-history-filter">
                <span>Status</span>
                <select value={requestStatusFilter} onChange={event => setRequestStatusFilter(event.target.value)}>
                  {requestStatusOptions.map(option => (
                    <option key={option} value={option}>
                      {option === "all" ? "All statuses" : option}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="attendance-history-filter" style={{ minWidth: "280px" }}>
            <span>Search</span>
            <input
              type="text"
              value={searchQuery}
              placeholder={config.searchPlaceholder}
              onChange={event => setSearchQuery(event.target.value)}
            />
          </label>
        </div>

        <div className="employee-attendance-history-scroll">
          <div
            className={`employee-attendance-history-header ${onRequestAction ? "employee-attendance-history-header-actions" : ""}`.trim()}
            role="row"
          >
            <span role="columnheader">Date Filed</span>
            <span role="columnheader">Request Type</span>
            <span role="columnheader">Details</span>
            <span role="columnheader">Schedule / Period</span>
            <span role="columnheader">Status</span>
            {onRequestAction && <span role="columnheader">Actions</span>}
          </div>

          {filteredRecords.length > 0 ? filteredRecords.map(item => (
            <div
              key={item.id}
              className={`employee-attendance-history-row ${onRequestAction ? "employee-attendance-history-row-actions" : ""}`.trim()}
              role="row"
            >
            <span role="cell">{formatDateTimeLabel(item.date_filed)}</span>
            <span role="cell">{item.request_type ?? "—"}</span>
            <span role="cell">
              <div className="employee-request-details-cell">
                <span className="employee-request-details-text" title={normalizeRequestDetails(item.details)}>{truncateRequestDetails(item.details)}</span>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => setSelectedRequest(item)}
                >
                  View
                </button>
              </div>
            </span>
            <span role="cell">{item.schedule_period ?? "—"}</span>
            <span role="cell">{item.status ?? "Pending"}</span>
            {onRequestAction && (
              <span role="cell" className="employee-request-actions-cell">
                <div className="employee-request-actions" role="group" aria-label={`Actions for request ${item.id}`}>
                  {resolvedRequestActions.map(action => {
                    const currentStatus = String(item.status ?? "").toLowerCase();
                    const allowedStatuses = Array.isArray(action.allowedStatuses)
                      ? action.allowedStatuses.map(value => String(value).toLowerCase())
                      : ["pending"];
                    const canReview = item.can_review !== false;
                    const isVisible = typeof action.isVisible === "function" ? action.isVisible(item) : true;
                    const isEnabled = isVisible && canReview && allowedStatuses.some(status => currentStatus.includes(status));

                    if (!isVisible) {
                      return null;
                    }

                    return (
                      <button
                        key={`${item.id}-${action.status}`}
                        className={action.variant ?? "btn"}
                        type="button"
                        disabled={requestActionLoadingId === item.id || !isEnabled}
                        onClick={() => onRequestAction(item, action.status)}
                      >
                        {requestActionLoadingId === item.id ? "Saving..." : action.label}
                      </button>
                    );
                  })}
                </div>
              </span>
            )}
            </div>
          )) : (
            <div className="empty-state">No requests found.</div>
          )}
        </div>

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
                    {selectedRequest.request_type ?? "Request"} filed on {formatDateTimeLabel(selectedRequest.date_filed)}
                  </p>
                </div>
                <button className="icon-btn request-details-close-btn" type="button" aria-label="Close request details" onClick={() => setSelectedRequest(null)}>✕</button>
              </div>
              <div className="request-details-modal-body">
                <div className="request-details-content">
                  {normalizeRequestDetails(selectedRequest.details)}
                </div>
              </div>
              <div className="modal-actions request-details-modal-actions">
                <button className="btn" type="button" onClick={() => setSelectedRequest(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
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