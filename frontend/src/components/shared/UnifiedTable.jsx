import React from 'react';
import { Search, ChevronUp, ChevronDown, ArrowUpDown, Loader2 } from 'lucide-react';
import './UnifiedTable.css';

const SortableHeader = ({ label, sortKey, currentSortKey, direction, onSort }) => {
  const isActive = currentSortKey === sortKey;
  return (
    <button
      type="button"
      className={`am-sort-btn ${isActive ? "is-active" : ""}`}
      onClick={() => onSort(sortKey)}
      aria-label={`Sort by ${label}`}
    >
      <span>{label}</span>
      <span className="am-sort-icon">
        {!isActive ? <ArrowUpDown size={14} /> : direction === "asc" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </span>
    </button>
  );
};

export default function UnifiedTable({
  title, // Optional header title
  columns = [], // { label, key, sortKey, sortable, expandable }
  data = [],
  totalRecords = 0,
  loading = false,
  error = null,
  // Pagination
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  rowsPerPage = '10',
  onRowsPerPageChange,
  // Filtering
  searchQuery = '',
  onSearchChange,
  dateStart = '',
  onDateStartChange,
  dateEnd = '',
  onDateEndChange,
  onClearFilters,
  extraFilters = null,
  // Sorting
  sortKey,
  sortDirection,
  onSort,
  // Row Rendering
  renderCell, // (item, columnKey) => ReactNode
  renderActions, // (item) => ReactNode
  emptyMessage = "No records found.",
  gridTemplateColumns,
}) {
  const visibleStart = data.length === 0 ? 0 : (currentPage - 1) * parseInt(rowsPerPage) + 1;
  const visibleEnd = Math.min(currentPage * parseInt(rowsPerPage), visibleStart + data.length - 1);

  return (
    <div className="am-content-panel">
      <div className="am-toolbar">
        {title && <h2 className="am-toolbar-title">{title}</h2>}
        <div className="am-toolbar-actions">
          <div className="am-filter-group">
            <label className="am-filter-field">
              <span className="am-filter-label">From</span>
              <input type="date" value={dateStart} onChange={e => onDateStartChange(e.target.value)} />
            </label>
            <label className="am-filter-field">
              <span className="am-filter-label">To</span>
              <input type="date" value={dateEnd} onChange={e => onDateEndChange(e.target.value)} />
            </label>
            {extraFilters}
          </div>
          <div className="am-search-container">
            <input 
              type="text"
              placeholder="Search..."
              className="am-search-input"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            <Search className="am-search-icon" />
          </div>
          <label className="am-rows-field">
            <span className="am-rows-label">Rows</span>
            <input
              type="text"
              inputMode="numeric"
              className="am-rows-input"
              value={rowsPerPage}
              onChange={e => onRowsPerPageChange(e.target.value)}
            />
          </label>
          <button className="am-btn-secondary" type="button" onClick={onClearFilters}>
            Clear
          </button>
        </div>
      </div>

      <div className="am-table-wrapper">
        <div className="am-table-header" role="row" style={{ gridTemplateColumns }}>
          {columns.map(col => (
            <span key={col.key} role="columnheader">
              {col.sortable ? (
                <SortableHeader 
                  label={col.label} 
                  sortKey={col.sortKey || col.key} 
                  currentSortKey={sortKey} 
                  direction={sortDirection} 
                  onSort={onSort} 
                />
              ) : (
                col.label
              )}
            </span>
          ))}
          <span role="columnheader">Actions</span>
        </div>

        <div className="am-table-body">
          {loading ? (
            <div className="am-loading">
              <Loader2 size={32} />
              <p>Syncing records...</p>
            </div>
          ) : error ? (
            <div className="am-error-state">
               <p>{error}</p>
            </div>
          ) : data.length === 0 ? (
            <div className="am-empty">{emptyMessage}</div>
          ) : data.map((item, i) => (
            <div className="am-table-row" key={item.id || i} role="row" style={{ gridTemplateColumns }}>
              {columns.map(col => (
                <span 
                  key={col.key} 
                  role="cell" 
                  className={col.expandable ? "am-table-cell-expandable" : ""}
                  style={{ minWidth: 0 }}
                >
                  {renderCell ? renderCell(item, col.key) : item[col.key]}
                </span>
              ))}
              <span role="cell" className="am-table-actions-cell">
                {renderActions && renderActions(item)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="am-table-pagination">
        <div className="am-pagination-summary">
          Showing {visibleStart}-{visibleEnd} of {totalRecords}
        </div>
        <div className="am-pagination-actions">
          <button className="am-pagination-btn" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
            Previous
          </button>
          <span className="am-pagination-info">Page {currentPage} of {totalPages}</span>
          <button className="am-pagination-btn" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
