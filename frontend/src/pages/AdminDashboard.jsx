import "../styles/DashboardLayout.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../api/api";
import DashboardSidebar from "../components/ResponsiveDashboardSidebar";
import MainDashboard from "./MainDashboard";
import useLiveDateTime from "../hooks/useLiveDateTime";
import useCurrentUser from "../hooks/useCurrentUser";
import usePermissions from "../hooks/usePermissions";
import { getFeatureAccess } from "../utils/featureAccess";
import AttendanceHistoryHighlights from "../components/AttendanceHistoryHighlights";
import FilingCenterPanel from "../components/FilingCenterPanel";
import DataPanel from "../components/DataPanel";
import ControlPanelSection from "../components/ControlPanelSection";
import EmployeesSection from "../components/EmployeesSection";
import AttendanceModule from "../components/AttendanceModule";
import ProfileSection from "../components/ProfileSection";
import { fetchAdminTeamRequests, fetchMyRequests, updateAdminTeamRequestStatus } from "../api/requests";
import { logout } from "../utils/logout";
import { normalizeAttendanceHistoryRecords, parseSqlDateTime, toLocalSqlDateTime } from "../api/attendance";
import { resolveAttendanceMainTag } from "../utils/attendanceTags";
import { useFeedback } from "../components/FeedbackContext";
import { formatFullDate } from "../utils/dateUtils";
import { buildAttendanceHighlights, buildRequestHighlights, HIGHLIGHT_IDS } from "../utils/highlightUtils";

const attendanceTagOptions = ["On Time", "Late", "Scheduled", "Off Scheduled"];

export default function AdminDashboard() {
  const dayOptions = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const workSetupOptions = ["Onsite", "Work From Home (WFH)"];
  const FIXED_SHIFT_START = { time: "9:00", period: "AM" };
  const FIXED_SHIFT_END = { time: "6:00", period: "PM" };
  const FIXED_SHIFT_LABEL = `${FIXED_SHIFT_START.time} ${FIXED_SHIFT_START.period} - ${FIXED_SHIFT_END.time} ${FIXED_SHIFT_END.period}`;
  const FIXED_BREAK_START = { time: "12:00", period: "PM" };
  const FIXED_BREAK_END = { time: "1:00", period: "PM" };
  const FIXED_BREAK_LABEL = `${FIXED_BREAK_START.time} ${FIXED_BREAK_START.period} - ${FIXED_BREAK_END.time} ${FIXED_BREAK_END.period}`;
  const adminMainDashboardSchedule = {
    startTime: FIXED_SHIFT_START.time,
    startPeriod: FIXED_SHIFT_START.period,
    endTime: FIXED_SHIFT_END.time,
    endPeriod: FIXED_SHIFT_END.period,
    breakStartTime: FIXED_BREAK_START.time,
    breakStartPeriod: FIXED_BREAK_START.period,
    breakEndTime: FIXED_BREAK_END.time,
    breakEndPeriod: FIXED_BREAK_END.period
  };
  const defaultDaySchedule = {
    shiftType: "Morning Shift",
    startTime: FIXED_SHIFT_START.time,
    startPeriod: FIXED_SHIFT_START.period,
    endTime: FIXED_SHIFT_END.time,
    endPeriod: FIXED_SHIFT_END.period,
    workSetup: "Onsite",
    breakStartTime: FIXED_BREAK_START.time,
    breakStartPeriod: FIXED_BREAK_START.period,
    breakEndTime: FIXED_BREAK_END.time,
    breakEndPeriod: FIXED_BREAK_END.period
  };
  const timeOptions = Array.from({ length: 24 }, (_, index) => {
    const hour = Math.floor(index / 2) + 1;
    const minute = (index % 2) * 30;
    return `${hour}:${minute.toString().padStart(2, "0")}`;
  });
  const MAX_SHIFT_MINUTES = 9 * 60;
  const createDefaultScheduleForm = () => ({
    days: ["Mon", "Tue", "Wed", "Thu", "Fri"],
    daySchedules: {
      Mon: { ...defaultDaySchedule },
      Tue: { ...defaultDaySchedule },
      Wed: { ...defaultDaySchedule },
      Thu: { ...defaultDaySchedule },
      Fri: { ...defaultDaySchedule }
    }
  });
  const [clusters, setClusters] = useState([]);
  const [rejectingCluster, setRejectingCluster] = useState(null);
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);
  const [coachAttendance, setCoachAttendance] = useState([]);
  const [allAttendance, setAllAttendance] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [managingScheduleCluster, setManagingScheduleCluster] = useState(null);
  const [teamRequests, setTeamRequests] = useState([]);
  const [teamRequestsError, setTeamRequestsError] = useState("");
  const [requestActionLoadingId, setRequestActionLoadingId] = useState("");
  const [scheduleModalMessage, setScheduleModalMessage] = useState("");
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(() => createDefaultScheduleForm());
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [editingCoachAttendance, setEditingCoachAttendance] = useState(null);
  const [editForm, setEditForm] = useState({ timeInAt: "", timeOutAt: "", tag: "", note: "" });
  const [editAttendanceMessage, setEditAttendanceMessage] = useState("");
  const [isSavingEditAttendance, setIsSavingEditAttendance] = useState(false);
  const [attendanceLog, setAttendanceLog] = useState({ timeInAt: null, timeOutAt: null, tag: null });
  const [isSavingAttendance, setIsSavingAttendance] = useState(false);

  const adminStats = useMemo(() => {
    const totals = (Array.isArray(coachAttendance) ? coachAttendance : []).reduce((acc, row) => {
      const timeIn = parseSqlDateTime(row?.time_in_at);
      const timeOut = parseSqlDateTime(row?.time_out_at);
      const status = String(row?.attendance_tag ?? row?.tag ?? "").toLowerCase();

      if (timeIn && timeOut && timeOut >= timeIn) {
        acc.totalHours += (timeOut.getTime() - timeIn.getTime()) / (1000 * 60 * 60);
      }

      if (timeIn) {
        acc.daysPresent.add(timeIn.toISOString().slice(0, 10));
      }

      if (status.includes("late")) acc.totalLate += 1;
      return acc;
    }, {
      totalHours: 0,
      daysPresent: new Set(),
      totalLate: 0
    });

    return {
      totalHours: totals.totalHours.toFixed(2),
      presentCount: totals.daysPresent.size,
      lateCount: totals.totalLate
    };
  }, [coachAttendance]);

  const handleAdminTimeIn = async () => {
    if (attendanceLog.timeInAt && !attendanceLog.timeOutAt) return;
    const now = new Date();
    const scheduledStartMinutes = toMinutes(FIXED_SHIFT_START.time, FIXED_SHIFT_START.period);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const lateThreshold = (scheduledStartMinutes ?? 540) + 15;
    const tag = nowMinutes <= lateThreshold ? "On Time" : "Late";

    await persistAttendance({
      timeInAt: now,
      timeOutAt: null,
      tag
    });
  };

  const handleAdminTimeOut = async () => {
    if (!attendanceLog.timeInAt || attendanceLog.timeOutAt) return;
    const hasConfirmed = await confirm({
      title: "Time Out?",
      message: "Are you sure you want to log your time out for today?",
      confirmLabel: "Time Out",
      variant: "primary"
    });
    if (!hasConfirmed) return;
    await persistAttendance({
      ...attendanceLog,
      timeOutAt: new Date()
    });
  };
  const dateTimeLabel = useLiveDateTime();
  const { user } = useCurrentUser();
  const { confirm } = useFeedback();
  const { hasPermission, loading: permissionsLoading } = usePermissions();
  const {
    canViewDashboard,
    canViewTeam,
    canViewAttendance,
    canEditAttendance,
    canAccessControlPanel,
    canAccessEmployeesTab
  } = getFeatureAccess(hasPermission);
  const attendanceNavItems = useMemo(() => ["My Attendance", "All Attendance", "My Requests", "My Filing Center", "File Request"], []);
  const [attendanceExpanded, setAttendanceExpanded] = useState(true);
  const [filingCenterInitialTab, setFilingCenterInitialTab] = useState("leave");
  const [filingCenterInitialDate, setFilingCenterInitialDate] = useState("");
  const isAttendanceView = activeNav === "Attendance" || attendanceNavItems.includes(activeNav);
  const navItems = [
    ...(canViewDashboard ? [{ label: "Dashboard", active: activeNav === "Dashboard", onClick: () => setActiveNav("Dashboard") }] : []),
    { label: "Profile", active: activeNav === "Profile", onClick: () => setActiveNav("Profile") },
    ...(canViewTeam ? [{ label: "Team", active: activeNav === "Team", onClick: () => setActiveNav("Team") }] : []),
    ...(canViewAttendance ? [{
      label: "Attendance",
      active: isAttendanceView,
      expanded: attendanceExpanded,
      onClick: () => setAttendanceExpanded(prev => !prev),
      children: attendanceNavItems.map(label => ({
        label,
        active: (label === "My Attendance" && activeNav === "Attendance") || activeNav === label,
        onClick: () => setActiveNav(label === "My Attendance" ? "Attendance" : label)
      }))
    }] : []),
    ...(canViewTeam ? [{ label: "Team Coach Schedule", active: activeNav === "Schedule", onClick: () => setActiveNav("Schedule") }] : []),
    ...(canAccessEmployeesTab ? [{ label: "Employees", active: activeNav === "Employees", onClick: () => setActiveNav("Employees") }] : []),
    ...(canAccessControlPanel ? [{ label: "Control Panel", active: activeNav === "Control Panel", onClick: () => setActiveNav("Control Panel") }] : [])
  ];

  useEffect(() => {
    if (permissionsLoading) {
      return;
    }

    const canAccessActiveNav = (
      (activeNav === "Dashboard" && canViewDashboard)
      || activeNav === "Profile"
      || ((activeNav === "Team" || activeNav === "Schedule") && canViewTeam)
      || ((activeNav === "Attendance" || attendanceNavItems.includes(activeNav)) && canViewAttendance)
      || (activeNav === "Employees" && canAccessEmployeesTab)
      || (activeNav === "Control Panel" && canAccessControlPanel)
    );

    if (canAccessActiveNav) {
      return;
    }

    if (canViewDashboard) {
      setActiveNav("Dashboard");
      return;
    }

    if (canViewTeam) {
      setActiveNav("Team");
      return;
    }

    if (canViewAttendance) {
      setActiveNav("Attendance");
      return;
    }

    if (canAccessEmployeesTab) {
      setActiveNav("Employees");
      return;
    }

    if (canAccessControlPanel) {
      setActiveNav("Control Panel");
      return;
    }

    setActiveNav("Profile");
  }, [activeNav, attendanceNavItems, canAccessControlPanel, canAccessEmployeesTab, canViewAttendance, canViewDashboard, canViewTeam, permissionsLoading]);

  const normalizeScheduleForm = coachSchedule => {
    const nextForm = createDefaultScheduleForm();
    const assignedDays = Array.isArray(coachSchedule?.days)
      ? coachSchedule.days.filter(day => dayOptions.includes(day))
      : [];

    if (assignedDays.length > 0) {
      nextForm.days = assignedDays;
    }

    assignedDays.forEach(day => {
      nextForm.daySchedules[day] = {
        ...defaultDaySchedule,
        ...(coachSchedule?.daySchedules?.[day] ?? {})
      };
    });

    return nextForm;
  };

  const formatTimeRange = daySchedule => {
    if (!daySchedule || typeof daySchedule !== "object") return "—";

    const {
      startTime,
      startPeriod,
      endTime,
      endPeriod
    } = daySchedule;

    if (!startTime || !startPeriod || !endTime || !endPeriod) return "Schedule set";
    return `${startTime} ${startPeriod} - ${endTime} ${endPeriod}`;
  };


  const toMinutes = (time, period) => {
    const [hourPart, minutePart] = String(time).split(":");
    const hour = Number(hourPart);
    const minute = Number(minutePart);
    if (Number.isNaN(hour) || Number.isNaN(minute) || hour < 1 || hour > 12 || ![0, 30].includes(minute)) {
      return null;
    }
    const normalizedHour = hour % 12;
    return normalizedHour * 60 + minute + (period === "PM" ? 12 * 60 : 0);
  };

  const getTimeOptionsWithinRange = (startTime, startPeriod, endTime, endPeriod) => {
    const startMinutes = toMinutes(startTime, startPeriod);
    const endMinutes = toMinutes(endTime, endPeriod);
    if (startMinutes === null || endMinutes === null) return [];

    let rangeEndMinutes = endMinutes;
    if (endMinutes < startMinutes) rangeEndMinutes += 24 * 60;

    const options = [];
    let current = startMinutes;
    while (current <= rangeEndMinutes) {
      const normalizedMinutes = ((current % (24 * 60)) + 24 * 60) % (24 * 60);
      const hour24 = Math.floor(normalizedMinutes / 60);
      const minute = normalizedMinutes % 60;
      const period = hour24 >= 12 ? "PM" : "AM";
      const hour12 = hour24 % 12 || 12;
      options.push({ time: `${hour12}:${String(minute).padStart(2, "0")}`, period });
      current += 30;
    }

    return options;
  };

  const getEndTimeOptions = (startTime, startPeriod) => {
    const startMinutes = toMinutes(startTime, startPeriod);
    if (startMinutes === null) {
      return timeOptions.map(time => ({ time, period: "AM" }));
    }

    const validOptions = [];
    for (let offset = 30; offset <= MAX_SHIFT_MINUTES; offset += 30) {
      const totalMinutes = startMinutes + offset;
      const normalizedMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
      const hour24 = Math.floor(normalizedMinutes / 60);
      const minute = normalizedMinutes % 60;
      const period = hour24 >= 12 ? "PM" : "AM";
      const hour12 = hour24 % 12 || 12;
      validOptions.push({
        time: `${hour12}:${String(minute).padStart(2, "0")}`,
        period
      });
    }

    return validOptions;
  };

  const getMinutesBetween = (startTime, startPeriod, endTime, endPeriod) => {
    const startMinutes = toMinutes(startTime, startPeriod);
    const endMinutes = toMinutes(endTime, endPeriod);
    if (startMinutes === null || endMinutes === null) return 0;
    if (endMinutes < startMinutes) return endMinutes + 24 * 60 - startMinutes;
    return endMinutes - startMinutes;
  };

  const formatBreakTimeRange = (startTime, startPeriod, endTime, endPeriod) => {
    if (!startTime || !startPeriod || !endTime || !endPeriod) return "—";
    return `${startTime} ${startPeriod} - ${endTime} ${endPeriod}`;
  };

  const formatCoachDaySchedule = (coachSchedule, day) => {
    const assignedDays = Array.isArray(coachSchedule?.days) ? coachSchedule.days : [];
    if (!assignedDays.includes(day)) return "—";

    const daySchedule = coachSchedule?.daySchedules?.[day];
    if (!daySchedule) {
      return {
        shift: "Schedule set",
        breakTime: "—"
      };
    }

    return {
      shift: formatTimeRange(daySchedule),
      breakTime: formatBreakTimeRange(
        daySchedule.breakStartTime,
        daySchedule.breakStartPeriod,
        daySchedule.breakEndTime,
        daySchedule.breakEndPeriod
      )
    };
  };

  const getAutomaticShiftType = (startTime, startPeriod) => {
    const startMinutes = toMinutes(startTime, startPeriod);
    if (startMinutes === null) return "Morning Shift";
    if (startMinutes >= 6 * 60 && startMinutes <= 11 * 60 + 30) return "Morning Shift";
    if (startMinutes >= 12 * 60 && startMinutes <= 19 * 60 + 30) return "Mid Shift";
    return "Night Shift";
  };

  const fetchClusters = useCallback(async () => {
    try {
      const data = await apiFetch("api/admin/admin_cluster.php");
      setClusters(data);
    } catch (error) {
      console.error("Failed to load clusters", error);
    }
  }, []);

  useEffect(() => {
    if (!canViewTeam) {
      setClusters([]);
      return undefined;
    }

    fetchClusters();
    const interval = setInterval(fetchClusters, 5000);
    return () => clearInterval(interval);
  }, [canViewTeam, fetchClusters]);

  useEffect(() => {
    if (!canViewAttendance) {
      setMyRequests([]);
      return;
    }

    fetchMyRequests().then(response => {
      setMyRequests(Array.isArray(response) ? response : []);
    }).catch(() => setMyRequests([]));
  }, [canViewAttendance]);

  useEffect(() => {
    if (!canViewAttendance || !["Dashboard", "File Request"].includes(activeNav)) return;

    fetchAdminTeamRequests()
      .then(response => {
        setTeamRequests(Array.isArray(response) ? response : []);
        setTeamRequestsError("");
      })
      .catch(() => {
        setTeamRequests([]);
        setTeamRequestsError("Unable to load endorsed file requests.");
      });
  }, [activeNav, canViewAttendance]);

  const isSameCalendarDay = (firstDate, secondDate) => {
    if (!(firstDate instanceof Date) || Number.isNaN(firstDate.getTime())) return false;
    if (!(secondDate instanceof Date) || Number.isNaN(secondDate.getTime())) return false;

    return (
      firstDate.getFullYear() === secondDate.getFullYear()
      && firstDate.getMonth() === secondDate.getMonth()
      && firstDate.getDate() === secondDate.getDate()
    );
  };

  const persistAttendance = async nextAttendance => {
    setIsSavingAttendance(true);

    try {
      const response = await apiFetch("api/admin/save_attendance.php", {
        method: "POST",
        body: JSON.stringify({
          ...nextAttendance,
          timeInAt: nextAttendance.timeInAt ? toLocalSqlDateTime(nextAttendance.timeInAt) : null,
          timeOutAt: nextAttendance.timeOutAt ? toLocalSqlDateTime(nextAttendance.timeOutAt) : null,
        })
      });

      const savedAttendance = {
        timeInAt: parseSqlDateTime(response?.attendance?.timeInAt ?? null),
        timeOutAt: parseSqlDateTime(response?.attendance?.timeOutAt ?? null),
        tag: response?.attendance?.tag ?? null,
      };

      setAttendanceLog(savedAttendance);
      return savedAttendance;
    } finally {
      setIsSavingAttendance(false);
    }
  };

  const getAdminTeamRequestActionConfirmationMessage = (request, status) => {
    const requestType = request?.request_type ?? "this request";
    if (status === "Approved") return `Are you sure you want to accept ${requestType}?`;
    if (status === "Denied") return `Are you sure you want to reject ${requestType}?`;
    return `Are you sure you want to update ${requestType}?`;
  };

  const handleAdminTeamRequestAction = async (request, status) => {
    if (!request?.id || !request?.request_source) return;

    const hasConfirmedAction = await confirm({
      title: status === "Approved" ? "Accept request?" : status === "Denied" ? "Reject request?" : "Confirm request action",
      message: getAdminTeamRequestActionConfirmationMessage(request, status),
      confirmLabel: status === "Approved" ? "Accept" : status === "Denied" ? "Reject" : "Confirm",
      variant: status === "Denied" ? "danger" : "primary"
    });
    if (!hasConfirmedAction) return;

    setRequestActionLoadingId(request.id);
    setTeamRequestsError("");
    try {
      await updateAdminTeamRequestStatus({
        request_source: request.request_source,
        request_id: request.source_id,
        status
      });

      setTeamRequests(prev => prev.map(item => (item.id === request.id ? { ...item, status } : item)));
    } catch (error) {
      setTeamRequestsError(error?.error ?? "Unable to finalize file request status.");
    } finally {
      setRequestActionLoadingId("");
    }
  };


  useEffect(() => {
    if (!canViewAttendance) return;

    const today = new Date().toISOString().slice(0, 10);
    apiFetch(`api/admin/admin_my_attendance.php?attendance_date=${today}`)
      .then(data => {
        const currentAttendance = Array.isArray(data) ? data[0] ?? null : null;
        if (currentAttendance) {
          setAttendanceLog({
            timeInAt: parseSqlDateTime(currentAttendance.time_in_at),
            timeOutAt: parseSqlDateTime(currentAttendance.time_out_at),
            tag: currentAttendance.attendance_tag ?? null
          });
        }
      })
      .catch(() => setAttendanceLog({ timeInAt: null, timeOutAt: null, tag: null }));
  }, [canViewAttendance]);

  useEffect(() => {
    if (activeNav !== "Attendance" || !canViewAttendance) return;
    apiFetch("api/admin/admin_my_attendance_history.php")
      .then(data => setCoachAttendance(Array.isArray(data) ? data : []))
      .catch(() => setCoachAttendance([]));
  }, [activeNav, canViewAttendance]);

  useEffect(() => {
    if (activeNav !== "All Attendance") return;
    apiFetch("api/admin/admin_all_attendance_history.php")
      .then(data => setAllAttendance(Array.isArray(data) ? data : []))
      .catch(() => setAllAttendance([]));
  }, [activeNav]);

  const toDateTimeLocalValue = value => {
    if (!value) return "";
    const date = new Date(value.replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const hours = `${date.getHours()}`.padStart(2, "0");
    const minutes = `${date.getMinutes()}`.padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const openAttendanceEdit = row => {
    setEditingCoachAttendance(row);
    setEditForm({
      timeInAt: toDateTimeLocalValue(row.time_in_at),
      timeOutAt: toDateTimeLocalValue(row.time_out_at),
      tag: row.attendance_tag ?? "",
      note: row.attendance_note ?? ""
    });
    setEditAttendanceMessage("");
  };

  const handleCloseAttendanceEdit = () => {
    setEditingCoachAttendance(null);
    setEditAttendanceMessage("");
  };

  const saveCoachAttendanceEdit = async () => {
    if (!editingCoachAttendance?.attendance_id || isSavingEditAttendance) return;

    setIsSavingEditAttendance(true);
    setEditAttendanceMessage("");

    try {
      const updatedAttendance = await apiFetch("api/admin/admin_update_coach_attendance.php", {
        method: "POST",
        body: JSON.stringify({
          attendance_id: editingCoachAttendance.attendance_id,
          employee_id: editingCoachAttendance.user_id ?? null,
          timeInAt: editForm.timeInAt ? `${editForm.timeInAt.replace("T", " ")}:00` : null,
          timeOutAt: editForm.timeOutAt ? `${editForm.timeOutAt.replace("T", " ")}:00` : null,
          tag: editForm.tag.trim() || null,
          note: editForm.note
        })
      });

      const refreshed = await apiFetch("api/admin/admin_all_attendance_history.php");
      const normalizedAttendance = Array.isArray(refreshed) ? refreshed : [];
      setAllAttendance(normalizedAttendance);

      const refreshedRow = normalizedAttendance.find(row => Number(row.attendance_id) === Number(editingCoachAttendance.attendance_id));
      if (refreshedRow) {
        setEditingCoachAttendance(refreshedRow);
        setEditForm({
          timeInAt: toDateTimeLocalValue(refreshedRow.time_in_at),
          timeOutAt: toDateTimeLocalValue(refreshedRow.time_out_at),
          tag: refreshedRow.attendance_tag ?? "",
          note: refreshedRow.attendance_note ?? ""
        });
      } else if (updatedAttendance?.attendance) {
        setEditForm({
          timeInAt: toDateTimeLocalValue(updatedAttendance.attendance.time_in_at),
          timeOutAt: toDateTimeLocalValue(updatedAttendance.attendance.time_out_at),
          tag: updatedAttendance.attendance.attendance_tag ?? updatedAttendance.attendance.tag ?? "",
          note: updatedAttendance.attendance.attendance_note ?? updatedAttendance.attendance.note ?? ""
        });
      }

      setEditAttendanceMessage("Attendance updated successfully.");
    } catch (error) {
      setEditAttendanceMessage(error?.error ?? "Unable to update attendance record.");
    } finally {
      setIsSavingEditAttendance(false);
    }
  };

  const handleToggleScheduleDay = day => {
    setScheduleModalMessage("");
    setScheduleForm(current => {
      const exists = current.days.includes(day);
      const nextDays = exists ? current.days.filter(item => item !== day) : [...current.days, day];
      const nextSchedules = { ...current.daySchedules };
      if (!nextSchedules[day]) nextSchedules[day] = { ...defaultDaySchedule };
      return { days: nextDays, daySchedules: nextSchedules };
    });
  };

  const handleChangeDayTime = (day, field, value) => {
    setScheduleModalMessage("");
    setScheduleForm(current => {
      const currentDay = current.daySchedules[day] ?? { ...defaultDaySchedule };
      const nextDay = { ...currentDay };
      const [time, period] = String(value).split("|");

      if (["endTime", "breakStart", "breakEnd"].includes(field)) {
        if (field === "endTime") {
          nextDay.endTime = time ?? currentDay.endTime;
          nextDay.endPeriod = period ?? currentDay.endPeriod;
        }

        if (field === "breakStart") {
          nextDay.breakStartTime = time ?? currentDay.breakStartTime;
          nextDay.breakStartPeriod = period ?? currentDay.breakStartPeriod;
        }

        if (field === "breakEnd") {
          nextDay.breakEndTime = time ?? currentDay.breakEndTime;
          nextDay.breakEndPeriod = period ?? currentDay.breakEndPeriod;
        }
      } else if (field === "startTime") {
        nextDay.startTime = time ?? currentDay.startTime;
        nextDay.startPeriod = period ?? currentDay.startPeriod;
      } else {
        nextDay[field] = value;
      }

      const endTimeOptions = getEndTimeOptions(nextDay.startTime, nextDay.startPeriod);
      const hasSelectedEndTime = endTimeOptions.some(
        option => option.time === nextDay.endTime && option.period === nextDay.endPeriod
      );
      if (!hasSelectedEndTime && endTimeOptions.length > 0) {
        nextDay.endTime = endTimeOptions[0].time;
        nextDay.endPeriod = endTimeOptions[0].period;
      }

      const shiftRangeOptions = getTimeOptionsWithinRange(
        nextDay.startTime,
        nextDay.startPeriod,
        nextDay.endTime,
        nextDay.endPeriod
      );
      const hasBreakStart = shiftRangeOptions.some(
        option => option.time === nextDay.breakStartTime && option.period === nextDay.breakStartPeriod
      );
      if (!hasBreakStart && shiftRangeOptions.length > 0) {
        const fallbackBreak = shiftRangeOptions[Math.min(1, shiftRangeOptions.length - 1)] ?? shiftRangeOptions[0];
        nextDay.breakStartTime = fallbackBreak.time;
        nextDay.breakStartPeriod = fallbackBreak.period;
      }

      const breakEndOptions = getTimeOptionsWithinRange(
        nextDay.breakStartTime,
        nextDay.breakStartPeriod,
        nextDay.endTime,
        nextDay.endPeriod
      );
      const hasBreakEnd = breakEndOptions.some(
        option => option.time === nextDay.breakEndTime && option.period === nextDay.breakEndPeriod
      );
      if (!hasBreakEnd && breakEndOptions.length > 0) {
        nextDay.breakEndTime = breakEndOptions[0].time;
        nextDay.breakEndPeriod = breakEndOptions[0].period;
      }

      nextDay.shiftType = getAutomaticShiftType(nextDay.startTime, nextDay.startPeriod);

      return {
        ...current,
        daySchedules: {
          ...current.daySchedules,
          [day]: nextDay
        }
      };
    });
  };

  const handleOpenScheduleModal = cluster => {
    setManagingScheduleCluster(cluster);
    setScheduleForm(normalizeScheduleForm(cluster?.coach_schedule));
    setScheduleModalMessage("");
  };

  const handleCloseScheduleModal = () => {
    setManagingScheduleCluster(null);
    setScheduleForm(createDefaultScheduleForm());
    setScheduleModalMessage("");
  };

  const handleCreateSchedule = async () => {
    if (!managingScheduleCluster || isSavingSchedule) return;

    const coachEmployeeId = Number(managingScheduleCluster.coach_employee_id);
    if (!Number.isInteger(coachEmployeeId) || coachEmployeeId <= 0) {
      setScheduleModalMessage("Unable to save schedule: coach employee profile is missing.");
      return;
    }

    setIsSavingSchedule(true);
    setScheduleModalMessage("");

    const normalizedSchedule = {
      days: scheduleForm.days.filter(day => dayOptions.includes(day)),
      daySchedules: Object.fromEntries(
        Object.entries(scheduleForm.daySchedules).map(([day, daySchedule]) => [
          day,
          {
            ...defaultDaySchedule,
            ...daySchedule,
            shiftType: getAutomaticShiftType(
              daySchedule?.startTime ?? defaultDaySchedule.startTime,
              daySchedule?.startPeriod ?? defaultDaySchedule.startPeriod
            )
          }
        ])
      )
    };

    try {
      await apiFetch("api/coach/save_schedule.php", {
        method: "POST",
        body: JSON.stringify({
          cluster_id: managingScheduleCluster.id,
          employee_id: coachEmployeeId,
          schedule: normalizedSchedule
        })
      });
      await fetchClusters();
      handleCloseScheduleModal();
    } catch (error) {
      setScheduleModalMessage(error?.error ?? "Unable to save schedule.");
    } finally {
      setIsSavingSchedule(false);
    }
  };

  async function updateStatus(id, status, reason = "") {
    await apiFetch("api/admin/approve_cluster.php", {
      method: "POST",
      body: JSON.stringify({
        cluster_id: id,
        status,
        rejection_reason: status === "rejected" ? reason : ""
      })
    });
    fetchClusters();
  }

const handleOpenRejectModal = cluster => {
    setRejectingCluster(cluster);
    setRejectionReason("");
    setRejectError("");
  };

  const handleCloseRejectModal = () => {
    setRejectingCluster(null);
    setRejectionReason("");
    setRejectError("");
  };

  const handleSubmitReject = async () => {
    const reason = rejectionReason.trim();
    if (!reason) {
      setRejectError("Please provide a reason before rejecting this team.");
      return;
    }

    if (!rejectingCluster) return;

    try {
      setIsSubmittingReject(true);
      await updateStatus(rejectingCluster.id, "rejected", reason);
      setRejectingCluster(null);
      setRejectionReason("");
      setRejectError("");
    } catch (error) {
      console.error("Failed to reject cluster", error);
      setRejectError("Unable to reject the cluster right now. Please try again.");
    } finally {
      setIsSubmittingReject(false);
    }
  };

  const [allAttendanceFilter, setAllAttendanceFilter] = useState(null);
  const [myRequestsFilter, setMyRequestsFilter] = useState(null);
  const [teamRequestsFilter, setTeamRequestsFilter] = useState(null);

  const filteredAllAttendance = useMemo(() => {
    const normalized = normalizeAttendanceHistoryRecords(allAttendance);
    if (!allAttendanceFilter || allAttendanceFilter === HIGHLIGHT_IDS.TOTAL_HOURS || allAttendanceFilter === HIGHLIGHT_IDS.DAYS_PRESENT) {
      return normalized;
    }
    return normalized.filter(row => {
      const status = String(row.status ?? "").toLowerCase();
      if (allAttendanceFilter === HIGHLIGHT_IDS.LATE) return status.includes("late");
      if (allAttendanceFilter === HIGHLIGHT_IDS.OVERTIME) return status.includes("overtime") || status.includes("over time");
      return true;
    });
  }, [allAttendance, allAttendanceFilter]);

  const filteredMyRequests = useMemo(() => {
    if (!myRequestsFilter || myRequestsFilter === HIGHLIGHT_IDS.TOTAL_REQUESTS) return myRequests;
    return myRequests.filter(item => {
      const status = String(item.status ?? "").toLowerCase();
      if (myRequestsFilter === HIGHLIGHT_IDS.PENDING) return status.includes("pending") || status.includes("endorsed");
      if (myRequestsFilter === HIGHLIGHT_IDS.APPROVED) return status.includes("approve");
      if (myRequestsFilter === HIGHLIGHT_IDS.REJECTED) return status.includes("reject") || status.includes("deny");
      return true;
    });
  }, [myRequests, myRequestsFilter]);

  const filteredTeamRequests = useMemo(() => {
    if (!teamRequestsFilter || teamRequestsFilter === HIGHLIGHT_IDS.TOTAL_REQUESTS) return teamRequests;
    return teamRequests.filter(item => {
      const status = String(item.status ?? "").toLowerCase();
      if (teamRequestsFilter === HIGHLIGHT_IDS.PENDING) return status.includes("pending") || status.includes("endorsed");
      if (teamRequestsFilter === HIGHLIGHT_IDS.APPROVED) return status.includes("approve");
      if (teamRequestsFilter === HIGHLIGHT_IDS.REJECTED) return status.includes("reject") || status.includes("deny");
      return true;
    });
  }, [teamRequests, teamRequestsFilter]);

  const myRequestHighlights = useMemo(() => buildRequestHighlights(myRequests), [myRequests]);
  const teamRequestHighlights = useMemo(() => buildRequestHighlights(teamRequests), [teamRequests]);
  const allAttendanceHighlights = useMemo(() => buildAttendanceHighlights(normalizeAttendanceHistoryRecords(allAttendance)), [allAttendance]);

  const handleHighlightFilterChange = (setter) => (id) => {
    setter(current => current === id ? null : id);
  };

  return (
    <div className="dashboard">
      <DashboardSidebar
        avatar="AD"
        roleLabel="Admin"
        userName={user?.fullname}
        navItems={navItems}
        onLogout={logout}
      />

      <main className="main">
        {activeNav === "Dashboard" && canViewDashboard ? (
          <section className="content">
            <MainDashboard
              showMemberStatusCard
              fileRequests={teamRequests}
              onViewFileRequests={() => setActiveNav("File Request")}
              attendanceControls={{
                timeInAt: attendanceLog.timeInAt,
                timeOutAt: attendanceLog.timeOutAt,
                canClickTimeIn: !isSavingAttendance && !(attendanceLog.timeInAt && !attendanceLog.timeOutAt),
                canClickTimeOut: !isSavingAttendance && Boolean(attendanceLog.timeInAt && !attendanceLog.timeOutAt),
                hasCompletedShift: isSameCalendarDay(attendanceLog.timeOutAt, new Date()) && !(attendanceLog.timeInAt && !attendanceLog.timeOutAt),
                onTimeIn: handleAdminTimeIn,
                onTimeOut: handleAdminTimeOut
              }}
              dashboardStats={adminStats}
              schedule={adminMainDashboardSchedule}
              dashboardMeta={{
                attendanceTag: resolveAttendanceMainTag({
                  attendanceTag: attendanceLog.tag,
                  schedule: adminMainDashboardSchedule,
                  timeInAt: attendanceLog.timeInAt,
                  fallbackTag: attendanceLog.timeInAt ? "Present" : "Scheduled"
                }),
                scheduleTag: "Fixed schedule",
                breakTag: "Break inactive",
                breakTime: FIXED_BREAK_LABEL,
                availabilityLabel: attendanceLog.timeInAt && !attendanceLog.timeOutAt ? "Available" : "Not available"
              }}
            />
          </section>
        ) : activeNav === "Team" && canViewTeam ? (
          <>
            <header className="topbar">
              <span className="datetime">{dateTimeLabel}</span>
            </header>

            <section className="content">
              <div className="section-title">Team clusters</div>
            {clusters.length === 0 ? (
                <div className="empty-state">No team clusters available.</div>
              ) : (
                <div className="table-card">
                  <div className="table-header">
                    <div>Cluster Name</div>
                    <div>Description</div>
                    <div>Members</div>
                    <div>Created</div>
                    <div>Status</div>
                    <div>Rejection Reason</div>
                    <div>Action</div>
                  </div>
                  {clusters.map(c => (
                    <div key={c.id} className="table-row">
                      <div className="table-cell">{c.name}</div>
                      <div className="table-cell muted">{c.description}</div>
                      <div className="table-cell">{c.members ?? 0}</div>
                      <div className="table-cell">{formatFullDate(c.created_at)}</div>
                      <div className="table-cell">
                        <span className={`badge ${c.status}`}>{c.status}</span>
                      </div>
                      <div className="table-cell muted">
                        {c.rejection_reason || "—"}
                      </div>
                      <div className="table-cell">
                        {c.status === "pending" ? (
                          <div className="card-actions">
                            <button
                              className="btn primary"
                              onClick={() => updateStatus(c.id, "active")}
                            >
                              Accept
                            </button>
                            <button
                              className="btn secondary"
                              onClick={() => handleOpenRejectModal(c)}
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="table-cell muted">—</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </section>
          </>
        ) : activeNav === "Attendance" && canViewAttendance ? (
          <section className="content">
            <div className="section-title">My Attendance</div>
            <div className="employee-card">
              <div className="employee-card-body employee-card-body-flush">
                <AttendanceModule records={coachAttendance} onDisputeClick={record => {
                  setFilingCenterInitialTab("dispute");
                  setFilingCenterInitialDate(record.date);
                  setActiveNav("My Filing Center");
                }} />
              </div>
            </div>
          </section>
          ) : activeNav === "All Attendance" && canViewAttendance ? (
          <section className="content">
            <div className="employee-card employee-attendance-history-card">
              <div className="employee-card-header">
                <div className="employee-card-title">All Attendance</div>
                <p className="employee-card-subtitle">Review all attendance logs across employees and coaches with the same polished summary view used in My Attendance.</p>
              </div>
              <div className="employee-card-body">
                <AttendanceHistoryHighlights 
                  highlights={allAttendanceHighlights} 
                  activeFilter={allAttendanceFilter}
                  onFilterChange={handleHighlightFilterChange(setAllAttendanceFilter)}
                />
                <DataPanel
                  type="attendance"
                  records={filteredAllAttendance}
                  personField="employee_name"
                  personLabel="Name"
                  onEditRow={canEditAttendance ? openAttendanceEdit : undefined}
                  externalDateFilter={attendanceDate}
                  onExternalDateFilterChange={setAttendanceDate}
                />
              </div>
            </div>
          </section>
        ) : activeNav === "My Requests" && canViewAttendance ? (
          <section className="content">
            <div className="section-title">My Requests</div>
            <AttendanceHistoryHighlights 
              highlights={myRequestHighlights} 
              activeFilter={myRequestsFilter}
              onFilterChange={handleHighlightFilterChange(setMyRequestsFilter)}
            />
            <DataPanel type="requests" records={filteredMyRequests} enableRequestFilters showRequestActionBy />
          </section>
        ) : activeNav === "My Filing Center" && canViewAttendance ? (
          <section className="content">
            <FilingCenterPanel
              initialTab={filingCenterInitialTab}
              initialDate={filingCenterInitialDate}
              onSubmitted={() => fetchMyRequests().then(response => setMyRequests(Array.isArray(response) ? response : [])).catch(() => setMyRequests([]))}
            />
          </section>
        ) : activeNav === "File Request" && canViewAttendance ? (
          <section className="content">
            <div className="section-title">File Requests</div>
            <p className="table-subtitle">Endorsed file requests waiting for final admin approval or rejection.</p>
            <AttendanceHistoryHighlights 
              highlights={teamRequestHighlights} 
              activeFilter={teamRequestsFilter}
              onFilterChange={handleHighlightFilterChange(setTeamRequestsFilter)}
            />
            {teamRequestsError && <div className="error">{teamRequestsError}</div>}
            <DataPanel
              type="requests"
              records={filteredTeamRequests}
              onRequestAction={handleAdminTeamRequestAction}
              requestActionLoadingId={requestActionLoadingId}
              requestActions={[
                { label: "Accept", status: "Approved", variant: "btn", allowedStatuses: ["endorsed"] },
                { label: "Reject", status: "Denied", variant: "btn secondary", allowedStatuses: ["endorsed"] }
              ]}
              enableRequestFilters
              personField="employee_name"
              personLabel="Name"
            />
          </section>
        ) : activeNav === "Profile" ? (
          <ProfileSection />
        ) : activeNav === "Employees" && canAccessEmployeesTab ? (
          <EmployeesSection />
        ) : activeNav === "Schedule" && canViewTeam ? (
          <section className="content">
            <div className="section-title">Team Coach Schedule</div>
            {clusters.length === 0 ? (
              <div className="empty-state">No team clusters available.</div>
            ) : (
              <>
                <div className="table-card">
                  <div className="table-header">
                    <div>Coach</div>
                    <div>Cluster Name</div>
                    <div>Members</div>
                    <div>Status</div>
                    <div>Action</div>
                  </div>
                  {clusters.map(cluster => (
                    <div key={cluster.id} className="table-row">
                      <div className="table-cell">{cluster.coach}</div>
                      <div className="table-cell">{cluster.name}</div>
                      <div className="table-cell" title={cluster.member_list || "No members"}>
                        <span className="member-count-pill">{cluster.members ?? 0} members</span>
                      </div>
                      <div className="table-cell">
                        <span className={`badge ${cluster.status}`}>{cluster.status}</span>
                      </div>
                      <div className="table-cell">
                        <button className="btn primary" type="button" onClick={() => handleOpenScheduleModal(cluster)}>
                          Manage Team Coach Schedule
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="section-title">Team Coach Schedule by Coach</div>
                <div className="active-members-schedule-table team-coach-schedule-scroll" role="table" aria-label="Team coach schedule by coach">
                  <div className="active-members-schedule-header" role="row">
                    <span role="columnheader">Members</span>
                    <span role="columnheader">Mon</span>
                    <span role="columnheader">Tue</span>
                    <span role="columnheader">Wed</span>
                    <span role="columnheader">Thu</span>
                    <span role="columnheader">Fri</span>
                    <span role="columnheader">Sat</span>
                    <span role="columnheader">Sun</span>
                    <span role="columnheader">Status</span>
                  </div>
                  <div className="active-members-schedule-body" role="rowgroup">
                    {[...clusters]
                      .sort((a, b) => (a.coach ?? "").localeCompare(b.coach ?? ""))
                      .map(cluster => (
                        <div key={`coach-schedule-${cluster.id}`} className="active-members-schedule-row" role="row">
                          <div className="active-members-owner" role="cell">{cluster.coach || "—"}</div>
                          {dayOptions.map(day => {
                            const daySchedule = formatCoachDaySchedule(cluster.coach_schedule, day);

                            if (typeof daySchedule === "string") {
                              return (
                                <div key={`${cluster.id}-${day}`} role="cell">{daySchedule}</div>
                              );
                            }

                            return (
                              <div key={`${cluster.id}-${day}`} role="cell" className="active-day-cell">
                                <div>{daySchedule.shift}</div>
                                <span className="active-day-tag break-tag">
                                  Break time: {daySchedule.breakTime}
                                </span>
                              </div>
                            );
                          })}
                          <div role="cell" className="member-status-and-tags-cell">
                            <span className={`badge ${cluster.status}`}>{cluster.status}</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}
          </section>
        ) : canAccessControlPanel && activeNav === "Control Panel" ? (
          <section className="content">
            <ControlPanelSection />
          </section>
        ) : null}
      </main>

      {editingCoachAttendance && (
        <div className="modal-overlay" role="presentation" onClick={handleCloseAttendanceEdit}>
          <section className="modal-card attendance-edit-modal" role="dialog" aria-modal="true" onClick={event => event.stopPropagation()}>
            <header className="modal-header">
              <div className="modal-title">Edit Coach Attendance</div>
              <button className="btn secondary" type="button" onClick={handleCloseAttendanceEdit}>Close</button>
            </header>
            <div className="modal-body">
              <div className="attendance-history-range-filter" role="group" aria-label="Edit coach attendance values">
                <label className="attendance-history-filter" htmlFor="admin-attendance-time-in"><span>Time In</span><input id="admin-attendance-time-in" type="datetime-local" value={editForm.timeInAt} onChange={event => setEditForm(curr => ({ ...curr, timeInAt: event.target.value }))} /></label>
                <label className="attendance-history-filter" htmlFor="admin-attendance-time-out"><span>Time Out</span><input id="admin-attendance-time-out" type="datetime-local" value={editForm.timeOutAt} onChange={event => setEditForm(curr => ({ ...curr, timeOutAt: event.target.value }))} /></label>
                <label className="attendance-history-filter" htmlFor="admin-attendance-tag">
                  <span>Tag</span>
                  <select id="admin-attendance-tag" value={editForm.tag} onChange={event => setEditForm(curr => ({ ...curr, tag: event.target.value }))}>
                    <option value="">Select tag</option>
                    {attendanceTagOptions.map(tag => <option key={tag} value={tag}>{tag}</option>)}
                  </select>
                </label>
                <label className="attendance-history-filter" htmlFor="admin-attendance-note"><span>Note</span><input id="admin-attendance-note" type="text" value={editForm.note} onChange={event => setEditForm(curr => ({ ...curr, note: event.target.value }))} /></label>
              </div>
              <div className="attendance-edit-actions">
                <button className="btn primary" type="button" disabled={isSavingEditAttendance} onClick={saveCoachAttendanceEdit}>{isSavingEditAttendance ? "Saving..." : "Save Attendance"}</button>
                {editAttendanceMessage && <span className="attendance-detail-value">{editAttendanceMessage}</span>}
              </div>
            </div>
          </section>
        </div>
      )}

      {managingScheduleCluster && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card schedule-modal">
            <div className="modal-header">
              <div>
                <div className="modal-title">Manage Schedule</div>
                <div className="modal-subtitle">
                  Cluster: {managingScheduleCluster.name} · Coach: {managingScheduleCluster.coach}
                </div>
              </div>
              <button className="btn link modal-close-btn" type="button" onClick={handleCloseScheduleModal}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <div className="schedule-card">
                <div className="schedule-heading">
                  <div className="schedule-label">Schedule Details</div>
                  <p className="schedule-helper-text">
                    Turn days on or off, then update the work shift and break windows.
                  </p>
                </div>
                <div className="schedule-day-grid">
                  {dayOptions.map(day => {
                    const isWorkingDay = scheduleForm.days.includes(day);
                    const daySchedule = scheduleForm.daySchedules[day] ?? { ...defaultDaySchedule };
                    const endTimeOptions = getEndTimeOptions(
                      daySchedule.startTime,
                      daySchedule.startPeriod
                    );
                    const shiftRangeOptions = getTimeOptionsWithinRange(
                      daySchedule.startTime,
                      daySchedule.startPeriod,
                      daySchedule.endTime,
                      daySchedule.endPeriod
                    );
                    const breakEndOptions = getTimeOptionsWithinRange(
                      daySchedule.breakStartTime,
                      daySchedule.breakStartPeriod,
                      daySchedule.endTime,
                      daySchedule.endPeriod
                    );
                    const shiftMinutes = getMinutesBetween(
                      daySchedule.startTime,
                      daySchedule.startPeriod,
                      daySchedule.endTime,
                      daySchedule.endPeriod
                    );
                    const breakMinutes = getMinutesBetween(
                      daySchedule.breakStartTime,
                      daySchedule.breakStartPeriod,
                      daySchedule.breakEndTime,
                      daySchedule.breakEndPeriod
                    );
                    const shiftHoursLabel = `${Math.floor(shiftMinutes / 60)} hrs`;
                    const breakLabel = `${breakMinutes} mins`;

                    return (
                      <div key={day} className="schedule-day-row">
                        <div className="schedule-day-header">
                          <label className="schedule-day-toggle">
                            <input
                              type="checkbox"
                              checked={isWorkingDay}
                              onChange={() => handleToggleScheduleDay(day)}
                            />
                            <span>{day}</span>
                          </label>
                          <span className={`schedule-day-status ${isWorkingDay ? "is-working" : "is-off"}`}>
                            {isWorkingDay ? "Working day" : "Off day"}
                          </span>
                        </div>
                        {isWorkingDay ? (
                          <div className="schedule-time-grid schedule-time-grid-layout">
                            <div className="schedule-panel">
                              <div className="schedule-panel-title">Main Shift</div>
                              <div className="schedule-time-row schedule-field">
                                <div className="schedule-time-label">Start Time</div>
                                <div className="schedule-start-time">
                                  <select
                                    value={daySchedule.startTime}
                                    onChange={event => handleChangeDayTime(day, "startTime", event.target.value)}
                                  >
                                    {timeOptions.map(time => (
                                      <option key={`${day}-start-${time}`} value={time}>
                                        {time}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    value={daySchedule.startPeriod}
                                    onChange={event => handleChangeDayTime(day, "startPeriod", event.target.value)}
                                  >
                                    <option value="AM">AM</option>
                                    <option value="PM">PM</option>
                                  </select>
                                </div>
                              </div>
                              <div className="schedule-time-row schedule-field">
                                <div className="schedule-time-label">End Time</div>
                                <select
                                  value={`${daySchedule.endTime}|${daySchedule.endPeriod}`}
                                  onChange={event => handleChangeDayTime(day, "endTime", event.target.value)}
                                >
                                  {endTimeOptions.map(option => (
                                    <option
                                      key={`${day}-end-${option.time}-${option.period}`}
                                      value={`${option.time}|${option.period}`}
                                    >
                                      {option.time} {option.period}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="schedule-panel-total">Total: {shiftHoursLabel}</div>
                            </div>
                            <div className="schedule-panel">
                              <div className="schedule-panel-title">Shift Details</div>
                              <div className="schedule-time-row schedule-field">
                                <div className="schedule-time-label">Shift Type</div>
                                <input type="text" value={daySchedule.shiftType} readOnly />
                              </div>
                              <div className="schedule-time-row schedule-field">
                                <div className="schedule-time-label">Work Setup</div>
                                <select
                                  value={daySchedule.workSetup}
                                  onChange={event => handleChangeDayTime(day, "workSetup", event.target.value)}
                                >
                                  {workSetupOptions.map(option => (
                                    <option key={`${day}-work-setup-${option}`} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <div className="schedule-panel">
                              <div className="schedule-panel-title">Scheduled Breaks</div>
                              <div className="schedule-time-row schedule-field">
                                <div className="schedule-time-label">Break Start</div>
                                <select
                                  className="schedule-break-select"
                                  value={`${daySchedule.breakStartTime}|${daySchedule.breakStartPeriod}`}
                                  onChange={event => handleChangeDayTime(day, "breakStart", event.target.value)}
                                >
                                  {shiftRangeOptions.map(option => (
                                    <option
                                      key={`${day}-break-start-${option.time}-${option.period}`}
                                      value={`${option.time}|${option.period}`}
                                    >
                                      {option.time} {option.period}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="schedule-time-row schedule-field">
                                <div className="schedule-time-label">Break End</div>
                                <select
                                  className="schedule-break-select"
                                  value={`${daySchedule.breakEndTime}|${daySchedule.breakEndPeriod}`}
                                  onChange={event => handleChangeDayTime(day, "breakEnd", event.target.value)}
                                >
                                  {breakEndOptions.map(option => (
                                    <option
                                      key={`${day}-break-end-${option.time}-${option.period}`}
                                      value={`${option.time}|${option.period}`}
                                    >
                                      {option.time} {option.period}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="schedule-panel-total">Total Break: {breakLabel}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="schedule-not-working">Not working</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {scheduleModalMessage && <div className="success-message">{scheduleModalMessage}</div>}
              <div className="form-actions">
                <button className="btn secondary" type="button" onClick={handleCloseScheduleModal}>
                  Cancel
                </button>
                <button className="btn primary" type="button" onClick={handleCreateSchedule} disabled={isSavingSchedule}>
                  {isSavingSchedule ? "Saving..." : "Save Schedule"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {rejectingCluster && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reject-modal-title">
          <div className="modal-card reject-modal-card">
            <div className="modal-header">
              <div>
                <div id="reject-modal-title" className="modal-title reject-modal-title">Reject File Request</div>
                <div className="modal-subtitle">{rejectingCluster.name}</div>
              </div>
              <button className="btn link modal-close-btn" type="button" onClick={handleCloseRejectModal}>
                Close
              </button>
            </div>
            <div className="modal-body">
              <p className="modal-text">Please share a clear reason so the team can improve and resubmit.</p>
              <label className="form-field" htmlFor="reject-reason">
                Rejection Reason
                <textarea
                  id="reject-reason"
                  rows={4}
                  value={rejectionReason}
                  onChange={event => {
                    setRejectionReason(event.target.value);
                    if (rejectError) setRejectError("");
                  }}
                  placeholder="Example: Team schedule overlaps with required on-site coverage."
                  autoFocus
                />
              </label>
              {rejectError && <div className="error">{rejectError}</div>}
              <div className="form-actions">
                <button className="btn" type="button" onClick={handleCloseRejectModal} disabled={isSubmittingReject}>
                  Cancel
                </button>
                <button className="btn danger" type="button" onClick={handleSubmitReject} disabled={isSubmittingReject}>
                  {isSubmittingReject ? "Rejecting..." : "Confirm Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
