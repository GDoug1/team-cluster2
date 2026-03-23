import React, { useMemo, useState } from 'react';
import { Search, Calendar, Clock, CheckCircle2, AlertCircle, ArrowUpRight, Loader2, ListTodo, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { useAttendanceHistory } from '../hooks/useAttendanceHistory';
import { normalizeAttendanceHistoryRecords } from '../api/attendance';
import { formatDateTime, formatFullDate } from '../utils/dateUtils';
import '../styles/AttendanceModule.css';

const StatCard = ({ title, value, delta, icon, colorClass, isOffline }) => {
  const IconComponent = icon;
  return (
    <div className="am-stat-card">
      <div className="am-stat-header">
        <span className="am-stat-title">{title}</span>
        <div className="am-stat-icon-wrapper" style={{ backgroundColor: colorClass }}>
          <IconComponent />
        </div>
      </div>
      <div className="am-stat-value" style={{ color: isOffline ? '#cbd5e1' : undefined }}>
        {isOffline ? "--" : value}
      </div>
      <div className="am-stat-delta">{isOffline ? "N/A" : delta}</div>
    </div>
  );
};

const getStatusColor = (status) => {
  const s = String(status).toLowerCase();
  if (['present', 'approved'].includes(s)) return '#52c41a';
  if (['absent', 'denied'].includes(s)) return '#f5222d';
  if (s === 'late') return '#faad14';
  if (s === 'pending') return '#1890ff';
  return '#cbd5e1';
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
      className={`table-sort-btn am-sort-btn ${isActive ? "is-active" : ""}`}
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

export default function AttendanceModule({
  records = null,
  loading: loadingProp = false,
  error: errorProp = null,
  onDisputeClick = null,
}) {
  const historyState = useAttendanceHistory();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateStartFilter, setDateStartFilter] = useState("");
  const [dateEndFilter, setDateEndFilter] = useState("");
  const [rowsPerPageInput, setRowsPerPageInput] = useState('10');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState("Date");
  const [sortDirection, setSortDirection] = useState("desc");

  const isControlled = Array.isArray(records);
  const rawData = isControlled ? records : historyState.data;
  const data = useMemo(() => normalizeAttendanceHistoryRecords(rawData), [rawData]);
  const loading = isControlled ? loadingProp : historyState.loading;
  const error = isControlled ? errorProp : historyState.error;

  const stats = useMemo(() => {
    if (!data.length) return { hours: '0.00', present: 0, late: 0, ot: '0.00' };
    
    const totalHrs = data.reduce((acc, curr) => acc + parseFloat(curr.total_hours || 0), 0);
    const presentCount = data.filter(r => ['present', 'approved'].includes(r.status.toLowerCase())).length;
    const lateCount = data.filter(r => r.status.toLowerCase() === 'late').length;
    
    return {
      hours: totalHrs.toFixed(2),
      present: presentCount,
      late: lateCount,
      ot: '0.00' 
    };
  }, [data]);

  const handleSort = key => {
    if (sortKey === key) {
      setSortDirection(current => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const filteredAndSortedData = useMemo(() => {
    let result = data.filter(item => {
      const entryDate = toDateInputValue(item.date);
      if (dateStartFilter && (!entryDate || entryDate < dateStartFilter)) return false;
      if (dateEndFilter && (!entryDate || entryDate > dateEndFilter)) return false;

      const haystack = [
        item.date,
        item.time_in,
        item.time_out,
        item.total_hours,
        item.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      
      return !searchQuery || haystack.includes(searchQuery.toLowerCase());
    });

    if (sortKey) {
      result.sort((a, b) => {
        let valA, valB;
        if (sortKey === "Date") {
          valA = new Date(a.date).getTime();
          valB = new Date(b.date).getTime();
        } else if (sortKey === "Total Hours") {
          valA = parseFloat(a.total_hours || 0);
          valB = parseFloat(b.total_hours || 0);
        } else {
          valA = String(a[sortKey.toLowerCase().replace(/ /g, "_")] || "").toLowerCase();
          valB = String(b[sortKey.toLowerCase().replace(/ /g, "_")] || "").toLowerCase();
        }

        const multiplier = sortDirection === "asc" ? 1 : -1;
        if (typeof valA === "number" && typeof valB === "number") {
          return (valA - valB) * multiplier;
        }
        return String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: "base" }) * multiplier;
      });
    }

    return result;
  }, [data, searchQuery, dateStartFilter, dateEndFilter, sortKey, sortDirection]);

  const parsedRowsPerPage = Number.parseInt(rowsPerPageInput, 10);
  const rowsPerPage = Number.isFinite(parsedRowsPerPage) && parsedRowsPerPage > 0 ? parsedRowsPerPage : 10;
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedData.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * rowsPerPage;
  const paginatedData = filteredAndSortedData.slice(pageStartIndex, pageStartIndex + rowsPerPage);
  const visibleStart = filteredAndSortedData.length === 0 ? 0 : pageStartIndex + 1;
  const visibleEnd = Math.min(pageStartIndex + rowsPerPage, filteredAndSortedData.length);

  const handleRowsPerPageChange = event => {
    const nextValue = event.target.value.replace(/[^0-9]/g, '');
    setRowsPerPageInput(nextValue);
    setCurrentPage(1);
  };

  const handleRowsPerPageBlur = () => {
    const normalizedValue = Number.parseInt(rowsPerPageInput, 10);
    setRowsPerPageInput(String(Number.isFinite(normalizedValue) && normalizedValue > 0 ? normalizedValue : 10));
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setDateStartFilter("");
    setDateEndFilter("");
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="am-loading">
        <Loader2 size={40} />
        <p style={{ color: '#64748b', fontWeight: 500 }}>Syncing records...</p>
      </div>
    );
  }

  const attendanceGridStyle = {
    gridTemplateColumns: "minmax(180px, 1.2fr) minmax(130px, 1fr) minmax(130px, 1fr) minmax(120px, 0.8fr) minmax(150px, 1fr) minmax(120px, 0.8fr)",
    minWidth: "830px"
  };

  return (
    <div className="am-container">
      {error && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
           <div className="am-offline-banner">Offline: {error}</div>
        </div>
      )}

      <div className="am-stats-grid">
        <StatCard title="Total Hours" value={stats.hours} delta="Calculated from logs" icon={Clock} colorClass="#64748b" isOffline={!!error} />
        <StatCard title="Days Present" value={stats.present} delta="Count of active shifts" icon={CheckCircle2} colorClass="#52c41a" isOffline={!!error} />
        <StatCard title="Total Late" value={stats.late} delta="Requires attention" icon={AlertCircle} colorClass="#faad14" isOffline={!!error} />
        <StatCard title="Overtime" value={stats.ot} delta="Pending approval" icon={ArrowUpRight} colorClass="#1890ff" isOffline={!!error} />
      </div>

      <div className="am-content-panel">
        <div className="am-toolbar">
          <h2 className="am-toolbar-title">My Attendance Logs</h2>
          <div className="am-toolbar-actions">
            <div className="am-filter-group">
              <label className="am-filter-field" htmlFor="att-from">
                <span className="am-filter-label">From</span>
                <input id="att-from" type="date" disabled={!!error} value={dateStartFilter} onChange={event => { setDateStartFilter(event.target.value); setCurrentPage(1); }} />
              </label>
              <label className="am-filter-field" htmlFor="att-to">
                <span className="am-filter-label">To</span>
                <input id="att-to" type="date" disabled={!!error} value={dateEndFilter} onChange={event => { setDateEndFilter(event.target.value); setCurrentPage(1); }} />
              </label>
            </div>
            <div className="am-search-container">
              <input 
                type="text"
                disabled={!!error}
                placeholder="Search logs..."
                className="am-search-input"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              />
              <Search className="am-search-icon" />
            </div>
            <label className="am-rows-field" htmlFor="attendance-rows-per-page">
              <span className="am-rows-label">Rows per page</span>
              <input
                id="attendance-rows-per-page"
                type="text"
                inputMode="numeric"
                disabled={!!error}
                placeholder="10"
                className="am-rows-input"
                value={rowsPerPageInput}
                onChange={handleRowsPerPageChange}
                onBlur={handleRowsPerPageBlur}
              />
            </label>
            <button className="am-btn-secondary" type="button" onClick={handleClearFilters} disabled={!!error}>
              Clear
            </button>
          </div>
        </div>

        <div className="am-table-wrapper employee-attendance-history-scroll">
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
            <span role="columnheader">Actions</span>
          </div>

          <div className="am-table-body">
            {error ? (
              <div className="am-error-state">
                <ListTodo size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                <p style={{ color: '#475569', fontWeight: 'bold' }}>Server Connection Lost</p>
              </div>
            ) : filteredAndSortedData.length === 0 ? (
              <div className="am-empty">No records found.</div>
            ) : paginatedData.map((record, i) => (
              <div className="employee-attendance-history-row" key={`${record.date}-${i}`} role="row" style={attendanceGridStyle}>
                <span role="cell" className="am-td-date">{formatFullDate(record.date)}</span>
                <span role="cell" className="am-td-time">{record.time_in}</span>
                <span role="cell" className="am-td-time">{record.time_out}</span>
                <span role="cell" className="am-td-total">{record.total_hours}h</span>
                <span role="cell">
                  <div className="am-status-cell">
                    <div className="am-status-dot" style={{ backgroundColor: getStatusColor(record.status) }} />
                    <span className="am-status-text">{record.status}</span>
                  </div>
                </span>
                <span role="cell">
                  <div className="am-actions-hover">
                    <button
                      className="am-action-btn primary"
                      onClick={() => onDisputeClick?.(record)}
                    >
                      Dispute
                    </button>
                  </div>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="employee-table-pagination am-table-pagination">
          <div className="employee-pagination-summary">
            Showing {visibleStart}-{visibleEnd} of {filteredAndSortedData.length}
          </div>
          <div className="employee-pagination-actions">
            <button className="btn secondary" type="button" onClick={() => setCurrentPage(page => Math.max(1, page - 1))} disabled={safeCurrentPage === 1 || !!error}>
              Previous
            </button>
            <div className="employee-pagination-page">Page {safeCurrentPage} of {totalPages}</div>
            <button className="btn secondary" type="button" onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))} disabled={safeCurrentPage === totalPages || !!error}>
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}