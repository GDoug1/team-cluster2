import React, { useMemo, useState } from 'react';
import { Clock, CheckCircle2, AlertCircle, ArrowUpRight, Loader2, ListTodo } from 'lucide-react';
import { useAttendanceHistory } from '../hooks/useAttendanceHistory';
import { normalizeAttendanceHistoryRecords } from '../api/attendance';
import { formatFullDate } from '../utils/dateUtils';
import AttendanceHistoryHighlights from './AttendanceHistoryHighlights';
import { buildAttendanceHighlights, HIGHLIGHT_IDS } from '../utils/highlightUtils';
import UnifiedTable from './shared/UnifiedTable';
import { useFeedback } from './FeedbackContext';
import '../styles/AttendanceModule.css';

const getStatusColor = (status) => {
  const s = String(status).toLowerCase();
  if (['present', 'approved', 'on time'].includes(s)) return '#52c41a';
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

export default function AttendanceModule({
  records = null,
  loading: loadingProp = false,
  error: errorProp = null,
  onDisputeClick = null,
}) {
  const { showToast } = useFeedback();
  const historyState = useAttendanceHistory();
  const [searchQuery, setSearchQuery] = useState('');
  const [dateStartFilter, setDateStartFilter] = useState("");
  const [dateEndFilter, setDateEndFilter] = useState("");
  const [rowsPerPageInput, setRowsPerPageInput] = useState('10');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState("Date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [activeHighlightFilter, setActiveHighlightFilter] = useState(null);

  const isControlled = Array.isArray(records);
  const rawData = isControlled ? records : historyState.data;
  const data = useMemo(() => normalizeAttendanceHistoryRecords(rawData), [rawData]);
  const loading = isControlled ? loadingProp : historyState.loading;
  const error = isControlled ? errorProp : historyState.error;

  const highlights = useMemo(() => buildAttendanceHighlights(data), [data]);

  useEffect(() => {
    if (error) {
      showToast({
        title: "Attendance Error",
        message: error,
        type: "error"
      });
    }
  }, [error, showToast]);

  const handleSort = key => {
    if (sortKey === key) {
      setSortDirection(current => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const handleHighlightFilterChange = (id) => {
    setActiveHighlightFilter(current => current === id ? null : id);
    setCurrentPage(1);
  };

  const filteredAndSortedData = useMemo(() => {
    let result = data.filter(item => {
      // 1. Highlight Filtering
      if (activeHighlightFilter && activeHighlightFilter !== HIGHLIGHT_IDS.TOTAL_HOURS && activeHighlightFilter !== HIGHLIGHT_IDS.DAYS_PRESENT) {
        const status = String(item.status || "").toLowerCase();
        if (activeHighlightFilter === HIGHLIGHT_IDS.TOTAL_LATE && status !== "late") return false;
        if (activeHighlightFilter === HIGHLIGHT_IDS.OVERTIME && !(status.includes("overtime") || status.includes("over time"))) return false;
      }

      // 2. Date Range Filtering
      const entryDate = toDateInputValue(item.date);
      if (dateStartFilter && (!entryDate || entryDate < dateStartFilter)) return false;
      if (dateEndFilter && (!entryDate || entryDate > dateEndFilter)) return false;

      // 3. Search Query Filtering
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
  }, [data, searchQuery, dateStartFilter, dateEndFilter, sortKey, sortDirection, activeHighlightFilter]);

  const parsedRowsPerPage = Number.parseInt(rowsPerPageInput, 10);
  const rowsPerPage = Number.isFinite(parsedRowsPerPage) && parsedRowsPerPage > 0 ? parsedRowsPerPage : 10;
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedData.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * rowsPerPage;
  const paginatedData = filteredAndSortedData.slice(pageStartIndex, pageStartIndex + rowsPerPage);

  const handleRowsPerPageChange = value => {
    const nextValue = value.replace(/[^0-9]/g, '');
    setRowsPerPageInput(nextValue);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setDateStartFilter("");
    setDateEndFilter("");
    setActiveHighlightFilter(null);
    setCurrentPage(1);
  };

  const columns = [
    { label: "Date", key: "date", sortable: true },
    { label: "Time In", key: "time_in", sortable: true },
    { label: "Time Out", key: "time_out", sortable: true },
    { label: "Total Hours", key: "total_hours", sortKey: "Total Hours", sortable: true },
    { label: "Status", key: "status", sortable: true },
  ];

  const renderCell = (record, key) => {
    switch (key) {
      case 'date':
        return <span className="am-td-date">{formatFullDate(record.date)}</span>;
      case 'time_in':
      case 'time_out':
        return <span className="am-td-time">{record[key]}</span>;
      case 'total_hours':
        return <span className="am-td-total">{record.total_hours}h</span>;
      case 'status':
        return (
          <div className="am-status-cell">
            <div className="am-status-dot" style={{ backgroundColor: getStatusColor(record.status) }} />
            <span className="am-status-text">{record.status}</span>
          </div>
        );
      default:
        return record[key];
    }
  };

  const renderActions = (record) => (
    <button
      className="am-action-btn primary"
      onClick={() => onDisputeClick?.(record)}
    >
      Dispute
    </button>
  );

  return (
    <div className="am-container">
      <AttendanceHistoryHighlights
        highlights={highlights}
        activeFilter={activeHighlightFilter}
        onFilterChange={handleHighlightFilterChange}
      />

      <UnifiedTable
        title="My Attendance Logs"
        columns={columns}
        data={paginatedData}
        totalRecords={filteredAndSortedData.length}
        loading={loading}
        error={error}
        // Pagination
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        rowsPerPage={rowsPerPageInput}
        onRowsPerPageChange={handleRowsPerPageChange}
        // Filtering
        searchQuery={searchQuery}
        onSearchChange={(val) => { setSearchQuery(val); setCurrentPage(1); }}
        dateStart={dateStartFilter}
        onDateStartChange={(val) => { setDateStartFilter(val); setCurrentPage(1); }}
        dateEnd={dateEndFilter}
        onDateEndChange={(val) => { setDateEndFilter(val); setCurrentPage(1); }}
        onClearFilters={handleClearFilters}
        // Sorting
        sortKey={sortKey}
        sortDirection={sortDirection}
        onSort={handleSort}
        // Rendering
        renderCell={renderCell}
        renderActions={renderActions}
        gridTemplateColumns="minmax(180px, 1.2fr) minmax(130px, 1fr) minmax(130px, 1fr) minmax(120px, 0.8fr) minmax(150px, 1fr) minmax(120px, 0.8fr)"
      />
    </div>
  );
}