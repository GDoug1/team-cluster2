import { apiFetch } from "./api";

export const parseSqlDateTime = value => {
  if (!value || typeof value !== "string") return null;
  const [datePart, timePart] = value.trim().split(" ");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes, seconds] = timePart.split(":").map(Number);
  if ([year, month, day, hours, minutes].some(Number.isNaN)) return null;
  return new Date(year, month - 1, day, hours, minutes, Number.isNaN(seconds) ? 0 : seconds);
};

export const toLocalSqlDateTime = date => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  const seconds = `${date.getSeconds()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
};

export const fetchAttendanceHistory = async () => {
  return await apiFetch("api/employee/employee_attendance_history.php");
};

const toDisplayTime = value => {
  if (!value) return "--";

  if (/^\d{1,2}:\d{2}\s?(AM|PM)$/i.test(String(value).trim())) {
    return value;
  }

  const parsed = parseSqlDateTime(value);
  if (!parsed) return "--";

  return parsed.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
};

const toDisplayDate = value => {
  if (!value) return new Date().toISOString().slice(0, 10);

  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())) {
    return value;
  }

  const parsed = parseSqlDateTime(value);
  if (!parsed) return new Date().toISOString().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
};

const toTotalHours = (timeInAt, timeOutAt, fallbackValue = null) => {
  if (fallbackValue !== null && fallbackValue !== undefined && fallbackValue !== "") {
    const total = Number.parseFloat(fallbackValue);
    return Number.isFinite(total) ? total.toFixed(2) : "0.00";
  }

  const timeIn = parseSqlDateTime(timeInAt);
  const timeOut = parseSqlDateTime(timeOutAt);
  if (!timeIn || !timeOut) return "0.00";

  const diffHours = (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60);
  return diffHours > 0 ? diffHours.toFixed(2) : "0.00";
};

export const normalizeAttendanceHistoryRecord = record => {
  const timeInAt = record?.time_in_at ?? null;
  const timeOutAt = record?.time_out_at ?? null;
  const sourceDate = record?.date ?? timeInAt ?? timeOutAt ?? record?.updated_at ?? null;
  const status = record?.status ?? record?.attendance_tag ?? record?.tag ?? "pending";

  return {
    date: toDisplayDate(sourceDate),
    time_in: record?.time_in ?? toDisplayTime(timeInAt),
    time_out: record?.time_out ?? toDisplayTime(timeOutAt),
    break_in: record?.break_in ?? "--",
    break_out: record?.break_out ?? "--",
    total_hours: toTotalHours(timeInAt, timeOutAt, record?.total_hours ?? null),
    status: String(status).toLowerCase(),
    raw: record,
  };
};

export const normalizeAttendanceHistoryRecords = records => (
  Array.isArray(records) ? records.map(normalizeAttendanceHistoryRecord) : []
);

export const saveDashboardAttendance = async ({ clusterId, nextAttendance }) => {
  const response = await apiFetch("api/employee/save_attendance.php", {
    method: "POST",
    body: JSON.stringify({
      cluster_id: clusterId,
      ...nextAttendance,
      timeInAt: nextAttendance.timeInAt ? toLocalSqlDateTime(nextAttendance.timeInAt) : null,
      timeOutAt: nextAttendance.timeOutAt ? toLocalSqlDateTime(nextAttendance.timeOutAt) : null,
    })
  });

  return {
    timeInAt: parseSqlDateTime(response?.attendance?.timeInAt ?? null),
    timeOutAt: parseSqlDateTime(response?.attendance?.timeOutAt ?? null),
    tag: response?.attendance?.tag ?? null,
  };
};