const defaultHighlights = [
  { key: "totalHours", label: "Total Hours", icon: "◷", accentClass: "is-slate", value: "--", subValue: "N/A" },
  { key: "daysPresent", label: "Days Present", icon: "◉", accentClass: "is-green", value: "--", subValue: "N/A" },
  { key: "totalLate", label: "Total Late", icon: "!", accentClass: "is-amber", value: "--", subValue: "N/A" },
  { key: "overtime", label: "Overtime", icon: "↗", accentClass: "is-blue", value: "--", subValue: "N/A" },
];

export default function AttendanceHistoryHighlights({ highlights = defaultHighlights }) {
  return (
    <div className="attendance-history-highlights" aria-label="Attendance summary highlights">
      {highlights.map(item => (
        <article key={item.key} className="attendance-history-highlight-card">
          <div className="attendance-history-highlight-header">
            <span>{item.labelText ?? item.label}</span>
            <span className={`attendance-history-highlight-icon ${item.accentClass}`}>{item.icon}</span>
          </div>
          <div className="attendance-history-highlight-value">{item.value ?? "--"}</div>
          <div className="attendance-history-highlight-subvalue">{item.subValue ?? "N/A"}</div>
        </article>
      ))}
    </div>
  );
}
