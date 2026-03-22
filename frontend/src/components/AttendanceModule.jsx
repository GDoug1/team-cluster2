import React, { useMemo, useState } from 'react';
import { Search, Calendar, Clock, CheckCircle2, AlertCircle, ArrowUpRight, Loader2, ListTodo } from 'lucide-react';
import { useAttendanceHistory } from '../hooks/useAttendanceHistory';
import { normalizeAttendanceHistoryRecords } from '../api/attendance';
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

export default function AttendanceModule({
  records = null,
  loading: loadingProp = false,
  error: errorProp = null,
  onDisputeClick = null,
}) {
  const historyState = useAttendanceHistory();
  const [searchQuery, setSearchQuery] = useState('');
  const [rowsPerPageInput, setRowsPerPageInput] = useState('10');
  const [currentPage, setCurrentPage] = useState(1);
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

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    return data.filter(r => 
      r.date?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      r.status?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [data, searchQuery]);

  const parsedRowsPerPage = Number.parseInt(rowsPerPageInput, 10);
  const rowsPerPage = Number.isFinite(parsedRowsPerPage) && parsedRowsPerPage > 0 ? parsedRowsPerPage : 10;
  const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStartIndex = (safeCurrentPage - 1) * rowsPerPage;
  const paginatedData = filteredData.slice(pageStartIndex, pageStartIndex + rowsPerPage);
  const visibleStart = filteredData.length === 0 ? 0 : pageStartIndex + 1;
  const visibleEnd = Math.min(pageStartIndex + rowsPerPage, filteredData.length);

  const handleRowsPerPageChange = event => {
    const nextValue = event.target.value.replace(/[^0-9]/g, '');
    setRowsPerPageInput(nextValue);
    setCurrentPage(1);
  };

  const handleRowsPerPageBlur = () => {
    const normalizedValue = Number.parseInt(rowsPerPageInput, 10);
    setRowsPerPageInput(String(Number.isFinite(normalizedValue) && normalizedValue > 0 ? normalizedValue : 10));
  };


  if (loading) {
    return (
      <div className="am-loading">
        <Loader2 size={40} />
        <p style={{ color: '#64748b', fontWeight: 500 }}>Syncing records...</p>
      </div>
    );
  }

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
            <button className="am-btn-outline" disabled={!!error}>
              <Calendar size={16} />
              <span>Filter Dates</span>
            </button>
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
          </div>
        </div>

        <div className="am-table-wrapper">
          <table className="am-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time In</th>
                <th>Time Out</th>
                <th>Total Hours</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {error ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '60px' }}>
                    <ListTodo size={48} color="#cbd5e1" style={{ marginBottom: '16px' }} />
                    <p style={{ color: '#475569', fontWeight: 'bold' }}>Server Connection Lost</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr><td colSpan={6} className="am-empty">No records found.</td></tr>
              ) : paginatedData.map((record, i) => (
                <tr key={i}>
                  <td className="am-td-date">{record.date}</td>
                  <td className="am-td-time">{record.time_in}</td>
                  <td className="am-td-time">{record.time_out}</td>
                  <td className="am-td-total">{record.total_hours}h</td>
                  <td>
                    <div className="am-status-cell">
                      <div className="am-status-dot" style={{ backgroundColor: getStatusColor(record.status) }} />
                      <span className="am-status-text">{record.status}</span>
                    </div>
                  </td>
                  <td>
                    <div className="am-actions-hover">
                      <button
                        className="am-action-btn primary"
                        onClick={() => onDisputeClick?.(record)}
                      >
                        Dispute
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="employee-table-pagination am-table-pagination">
          <div className="employee-pagination-summary">
            Showing {visibleStart}-{visibleEnd} of {filteredData.length}
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