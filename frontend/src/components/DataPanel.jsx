import { useMemo, useState } from "react";
import { CheckCircle2, XCircle, ChevronUp, ChevronDown, ArrowUpDown } from "lucide-react";
import { normalizeAttendanceHistoryRecord, parseSqlDateTime } from "../api/attendance";
import { formatDateTime } from "../utils/dateUtils";
import { useFeedback } from "./FeedbackContext";

const normalizeRequestDetails = value => {
  const text = String(value ?? "").trim();
  return text || "—";
};

const truncateRequestDetails = (value, maxLength = 72) => {
  const details = normalizeRequestDetails(value);
  if (details === "—" || details.length <= maxLength) return details;
  return `${details.slice(0, maxLength).trimEnd()}…`;
};

const resolveRequestPhotoUrl = value => {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if (/^https?:\/\//i.test(text)) return text;
  const baseUrl = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost/team-cluster2/backend").replace(/\/$/, "");
  return `${baseUrl}/${text.replace(/^\/+/, "")}`;
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

const formatAttendanceDate = value => {
  if (!value) return "—";
  const parsed = parseSqlDateTime(value) ?? new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString([], {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
};

const formatAttendanceTime = value => {
  if (!value) return "—";
  const parsed = parseSqlDateTime(value) ?? new Date(String(value).replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
};

const getPersonPrimaryValue = (item, field) => {
  const value = String(item?.[field] ?? "").trim();
  return value || "—";
};

const getPersonSecondaryValue = (item, field) => {
  const candidates = [
    item?.person_secondary_name,
    item?.employee_username,
    item?.username,
    item?.user_name,
    item?.email,
  ];
  const secondaryValue = candidates
    .map(value => String(value ?? "").trim())
    .find(Boolean);

  if (!secondaryValue) return "";
  const primaryValue = getPersonPrimaryValue(item, field);
  return secondaryValue.toLowerCase() === primaryValue.toLowerCase() ? "" : secondaryValue;
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

const SortableHeader = ({ label, sortKey, currentSortKey, direction, onSort }) => {
  const isActive = currentSortKey === sortKey;
  return (
    <button
      type="button"
      className={`table-sort-btn ${isActive ? "is-active" : ""}`}
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      <span className="table-sort-icon">
        {!isActive ? <ArrowUpDown size={14} /> : direction === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </span>
    </button>
  );
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
  showRequestActionBy = false,
}) {
  const { confirm } = useFeedback();
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

  const getSortValue = (item, key) => {
    if (type === "attendance") {
      if (key === "Date") return new Date(item.time_in_at ?? item.time_out_at ?? 0).getTime();
      if (key === "Time In") return new Date(item.time_in_at ?? 0).getTime();
      if (key === "Time Out") return new Date(item.time_out_at ?? 0).getTime();
      if (key === "Total Hours") return Number(normalizeAttendanceHistoryRecord(item).total_hours || 0);
      if (key === "Status") return String(item.attendance_tag ?? item.tag ?? "").toLowerCase();
      if (key === "Cluster") return String(item.cluster_name ?? "").toLowerCase();
      if (key === personLabel) return String(item[personField] ?? "").toLowerCase();
      return String(item[key.toLowerCase().replace(/ /g, "_")] ?? "").toLowerCase();
    }
    if (type === "requests") {
      if (key === "Date Filed") return new Date(item.date_filed ?? 0).getTime();
      if (key === personLabel) return String(item[personField] ?? "").toLowerCase();
      if (key === "Status") return String(item.status ?? "").toLowerCase();
      if (key === "Request Type") return String(item.request_type ?? "").toLowerCase();
      return String(item[key.toLowerCase().replace(/ /g, "_")] ?? "").toLowerCase();
    }
    return "";
  };

  const handleActionClick = async (item, action) => {
    if (!onRequestAction) return;

    const isDenial =
      action.status.toLowerCase().includes("reject") ||
      action.status.toLowerCase().includes("denied") ||
      action.status.toLowerCase().includes("decline");

    if (isDenial) {
      const ok = await confirm({
        title: `Confirm ${action.label}`,
        message: `Are you sure you want to ${action.label.toLowerCase()} this request?`,
        confirmLabel: action.label,
        variant: "danger",
      });
      if (!ok) return;
    }

    onRequestAction(item, action.status);
  };

  const requestTypeOptions = useMemo(() => ([
    "all",
    ...new Set(records.map(item => String(item.request_type ?? "").trim()).filter(Boolean))
  ]), [records]);

  const requestStatusOptions = useMemo(() => ([
    "all",
    ...new Set(records.map(item => String(item.status ?? "").trim()).filter(Boolean))
  ]), [records]);

  const parsedRowsPerPage = Number.parseInt(rowsPerPageInput, 10);
  const rowsPerPage = Number.isFinite(parsedRowsPerPage) && parsedRowsPerPage > 0 ? parsedRowsPerPage : 10;

  const handleRowsPerPageChange = event => {
    const nextValue = event.target.value.replace(/[^0-9]/g, "");
    setRowsPerPageInput(nextValue);
    setCurrentPage(1);
  };

  const handleRowsPerPageBlur = () => {
    const normalizedValue = Number.parseInt(rowsPerPageInput, 10);
    setRowsPerPageInput(String(Number.isFinite(normalizedValue) && normalizedValue > 0 ? normalizedValue : 10));
  };

  const filteredAndSortedRecords = useMemo(() => {
    let result = [];
    if (type === "requests") {
      result = records.filter(item => {
        const entryDate = toDateInputValue(item.date_filed);
        if (dateStartFilter && (!entryDate || entryDate < dateStartFilter)) return false;
        if (dateEndFilter && (!entryDate || entryDate > dateEndFilter)) return false;

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
  }, [type, records, dateStartFilter, dateEndFilter, externalDateFilter, searchQuery, personField, enableRequestFilters, requestTypeFilter, requestStatusFilter, sortKey, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRecords.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * rowsPerPage;
  const paginatedRecords = filteredAndSortedRecords.slice(pageStartIndex, pageStartIndex + rowsPerPage);
  const visibleStart = filteredAndSortedRecords.length === 0 ? 0 : pageStartIndex + 1;
  const visibleEnd = Math.min(pageStartIndex + rowsPerPage, filteredAndSortedRecords.length);



  if (type === "attendance") {
    const attendanceColumnCount = 7 + (personField ? 1 : 0) + (onEditRow ? 1 : 0);
    const attendanceGridStyle = {
      gridTemplateColumns: `repeat(${attendanceColumnCount}, minmax(140px, 1fr))`,
      minWidth: `${attendanceColumnCount * 140}px`
    };

    return (
      <div className="employee-attendance-history-table" role="table" aria-label={config.title}>
        <div className="attendance-history-range-filter" role="group" aria-label="Filter attendance history">
          <label className="employee-search-field" htmlFor="att-from">
            <span className="employee-control-label">From</span>
            <input id="att-from" type="date" value={dateStartFilter} onChange={event => setDateStartFilter(event.target.value)} />
          </label>
          <label className="employee-search-field" htmlFor="att-to">
            <span className="employee-control-label">To</span>
            <input id="att-to" type="date" value={dateEndFilter} onChange={event => setDateEndFilter(event.target.value)} />
          </label>
          {typeof onExternalDateFilterChange === "function" && (
            <label className="employee-search-field" htmlFor="att-ext-date">
              <span className="employee-control-label">Date</span>
              <input id="att-ext-date" type="date" value={externalDateFilter ?? ""} onChange={event => onExternalDateFilterChange(event.target.value)} />
            </label>
          )}
          <label className="employee-search-field" htmlFor="att-search" style={{ flex: "1 1 260px" }}>
            <span className="employee-control-label">Search</span>
            <input id="att-search" type="text" value={searchQuery} placeholder={config.searchPlaceholder} onChange={event => { setSearchQuery(event.target.value); setCurrentPage(1); }} />
          </label>
          <label className="employee-rows-field" htmlFor="att-rows">
            <span className="employee-control-label">Rows per page</span>
            <input id="att-rows" type="text" inputMode="numeric" placeholder="10" value={rowsPerPageInput} onChange={handleRowsPerPageChange} onBlur={handleRowsPerPageBlur} />
          </label>
        </div>

        <div className="employee-attendance-history-scroll">
          <div className="employee-attendance-history-header" role="row" style={attendanceGridStyle}>
            <span role="columnheader">
              <SortableHeader label="Date" sortKey="Date" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
            </span>
            <span role="columnheader">
              <SortableHeader label="Time In" sortKey="Time In" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
            </span>
            <span role="columnheader">
              <SortableHeader label="Time Out" sortKey="Time Out" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
            </span>
            <span role="columnheader">
              <SortableHeader label="Total Hours" sortKey="Total Hours" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
            </span>
            <span role="columnheader">
              <SortableHeader label="Status" sortKey="Status" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
            </span>
            <span role="columnheader">
              <SortableHeader label="Cluster" sortKey="Cluster" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
            </span>
            <span role="columnheader">Note</span>
            {personField && (
              <span role="columnheader">
                <SortableHeader label={personLabel} sortKey={personLabel} currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
              </span>
            )}
            {onEditRow && <span role="columnheader">Action</span>}
          </div>
          {filteredAndSortedRecords.length > 0 ? paginatedRecords.map(item => {
            const normalizedAttendance = normalizeAttendanceHistoryRecord(item);
            const attendanceDateValue = item.time_in_at ?? item.time_out_at ?? item.updated_at ?? item.attendance_updated_at;

            return (
              <div
                key={`${item.id ?? item.attendance_id}-${item.updated_at ?? item.attendance_updated_at ?? item.time_in_at ?? "entry"}`}
                className="employee-attendance-history-row"
                role="row"
                style={attendanceGridStyle}
              >
                <span role="cell">{formatAttendanceDate(attendanceDateValue)}</span>
                <span role="cell">{formatAttendanceTime(item.time_in_at)}</span>
                <span role="cell">{formatAttendanceTime(item.time_out_at)}</span>
                <span role="cell" className="employee-attendance-total-hours-cell">{normalizedAttendance.total_hours}h</span>
                <span role="cell">{item.attendance_tag ?? item.tag ?? "Pending"}</span>
                <span role="cell">{item.cluster_name ?? "—"}</span>
                <span role="cell">{item.attendance_note ?? item.note ?? "—"}</span>
                {personField && (
                  <span role="cell" className="team-attendance-employee-cell">
                    <span>{getPersonPrimaryValue(item, personField)}</span>
                    {getPersonSecondaryValue(item, personField) && <small>{getPersonSecondaryValue(item, personField)}</small>}
                  </span>
                )}
                {onEditRow && (
                  <span role="cell">
                    <button
                      className="btn"
                      type="button"
                      aria-label={`Edit attendance for ${formatAttendanceDate(attendanceDateValue)}`}
                      onClick={() => onEditRow(item)}
                    >
                      Edit
                    </button>
                  </span>
                )}
              </div>
            );
          }) : (
            <div className="empty-state">No attendance records match the selected filters.</div>
          )}
        </div>

        <div className="employee-table-pagination employee-attendance-pagination">
          <div className="employee-pagination-summary">
            Showing {visibleStart}-{visibleEnd} of {filteredAndSortedRecords.length}
          </div>
          <div className="employee-pagination-actions">
            <button className="btn secondary" type="button" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={safeCurrentPage === 1}>
              Previous
            </button>
            <div className="employee-pagination-page">Page {safeCurrentPage} of {totalPages}</div>
            <button className="btn secondary" type="button" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={safeCurrentPage === totalPages}>
              Next
            </button>
          </div>
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
              <div className="attendance-history-filter">
                <label htmlFor="req-type">Request Type</label>
                <select id="req-type" value={requestTypeFilter} onChange={event => { setRequestTypeFilter(event.target.value); setCurrentPage(1); }}>
                  {requestTypeOptions.map(option => (
                    <option key={option} value={option}>
                      {option === "all" ? "All request types" : option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="attendance-history-filter">
                <label htmlFor="req-status">Status</label>
                <select id="req-status" value={requestStatusFilter} onChange={event => { setRequestStatusFilter(event.target.value); setCurrentPage(1); }}>
                  {requestStatusOptions.map(option => (
                    <option key={option} value={option}>
                      {option === "all" ? "All statuses" : option}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div className="attendance-history-filter" style={{ minWidth: "280px" }}>
            <label htmlFor="req-search">Search</label>
            <input
              id="req-search"
              type="text"
              value={searchQuery}
              placeholder={config.searchPlaceholder}
              onChange={event => { setSearchQuery(event.target.value); setCurrentPage(1); }}
            />
          </div>
          <div className="attendance-history-filter attendance-history-rows-filter">
            <label htmlFor="req-rows">Rows per page</label>
            <input id="req-rows" type="text" inputMode="numeric" placeholder="10" value={rowsPerPageInput} onChange={handleRowsPerPageChange} onBlur={handleRowsPerPageBlur} />
          </div>
        </div>

        <div className="employee-attendance-history-scroll">
          <div
            className={`employee-attendance-history-header ${showRequestActionBy ? "employee-attendance-history-header-actor" : ""} ${personField ? "employee-attendance-history-header-person" : ""} ${onRequestAction ? "employee-attendance-history-header-actions" : ""}`.trim()}
            role="row"
          >
            <span role="columnheader">
              <SortableHeader label="Date Filed" sortKey="Date Filed" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
            </span>
            {personField && (
              <span role="columnheader">
                <SortableHeader label={personLabel} sortKey={personLabel} currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
              </span>
            )}
            <span role="columnheader">
              <SortableHeader label="Request Type" sortKey="Request Type" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
            </span>
            <span role="columnheader">Details</span>
            <span role="columnheader">Schedule / Period</span>
            <span role="columnheader">
              <SortableHeader label="Status" sortKey="Status" currentSortKey={sortKey} direction={sortDirection} onSort={handleSort} />
            </span>
            {showRequestActionBy && <span role="columnheader">Accepted / Rejected By</span>}
            {showRequestActionBy && <span role="columnheader">Accepted / Rejected Date</span>}
            {onRequestAction && <span role="columnheader">Actions</span>}
          </div>

          {filteredAndSortedRecords.length > 0 ? paginatedRecords.map(item => {
            const photoUrl = resolveRequestPhotoUrl(item.photo_url ?? item.photo_path);

            return (
              <div
                key={item.id}
                className={`employee-attendance-history-row ${showRequestActionBy ? "employee-attendance-history-row-actor" : ""} ${personField ? "employee-attendance-history-row-person" : ""} ${onRequestAction ? "employee-attendance-history-row-actions" : ""}`.trim()}
                role="row"
              >
                <span role="cell">{formatDateTime(item.date_filed)}</span>
                {personField && (
                  <span role="cell" className="team-attendance-employee-cell">
                    <span>{getPersonPrimaryValue(item, personField)}</span>
                    {getPersonSecondaryValue(item, personField) && <small>{getPersonSecondaryValue(item, personField)}</small>}
                  </span>
                )}
                <span role="cell">{item.request_type ?? "—"}</span>
                <span role="cell">
                  <div className="employee-request-details-cell">
                    <span className="employee-request-details-text" title={normalizeRequestDetails(item.details)}>{truncateRequestDetails(item.details)}</span>
                    <button
                      className="btn secondary"
                      type="button"
                      aria-label={`View details for ${item.request_type || "request"} filed on ${formatDateTime(item.date_filed)}`}
                      onClick={() => setSelectedRequest(item)}
                    >
                      View
                    </button>
                  </div>
                </span>
                <span role="cell">{item.schedule_period ?? "—"}</span>
                <span role="cell">
                  <div className="employee-request-status-cell">
                    <span>{item.status ?? "Pending"}</span>
                    {photoUrl ? (
                      <button
                        className="btn secondary employee-request-photo-btn"
                        type="button"
                        aria-label={`View supporting photo for ${item.request_type || "request"}`}
                        onClick={() => setSelectedRequest(item)}
                      >
                        View Photo
                      </button>
                    ) : (
                      <span className="employee-request-photo-empty">No photo</span>
                    )}
                  </div>
                </span>
                {showRequestActionBy && (
                  <span role="cell" className="team-attendance-employee-cell">
                    <span>{getPersonPrimaryValue(item, 'request_action_by_name')}</span>
                    {item?.request_action_by_role ? <small>{item.request_action_by_role}</small> : null}
                  </span>
                )}
                {showRequestActionBy && (
                  <span role="cell">
                    {formatDateTime(item.request_action_at)}
                  </span>
                )}
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

                        const personName = getPersonPrimaryValue(item, personField);
                        const descriptiveLabel = `${action.label} request by ${personName !== "—" ? personName : "this employee"}`;

                        return (
                          <button
                            key={`${item.id}-${action.status}`}
                            className={`${action.variant ?? "btn"} action-icon-btn`}
                            type="button"
                            title={action.label}
                            aria-label={descriptiveLabel}
                            disabled={requestActionLoadingId === item.id || !isEnabled}
                            onClick={() => handleActionClick(item, action)}
                          >
                            {requestActionLoadingId === item.id ? (
                              "…"
                            ) : (action.status === "Approved" || action.status === "Endorsed") ? (
                              <CheckCircle2 size={18} aria-hidden="true" />
                            ) : (
                              <XCircle size={18} aria-hidden="true" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </span>
                )}
              </div>
            );
          }) : (
            <div className="empty-state">No requests found.</div>
          )}
        </div>

        <div className="employee-table-pagination employee-attendance-pagination">
          <div className="employee-pagination-summary">
            Showing {visibleStart}-{visibleEnd} of {filteredAndSortedRecords.length}
          </div>
          <div className="employee-pagination-actions">
            <button className="btn secondary" type="button" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={safeCurrentPage === 1}>
              Previous
            </button>
            <div className="employee-pagination-page">Page {safeCurrentPage} of {totalPages}</div>
            <button className="btn secondary" type="button" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={safeCurrentPage === totalPages}>
              Next
            </button>
          </div>
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