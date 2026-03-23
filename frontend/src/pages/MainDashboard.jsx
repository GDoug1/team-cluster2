import { useEffect, useMemo, useState } from "react";
import { createAnnouncement, fetchAnnouncements } from "../api/announcement";
import "../styles/MainDashboard.css";

function DashboardHeader({ dateTimeLabel }) {
  return (
    <section className="dashboard-header">
      <div className="datetime">{dateTimeLabel}</div>
    </section>
  );
}

function TimeCard({
  counterDisplay,
  hasActiveTimeIn,
  onToggleTimeIn,
  isButtonDisabled = false,
  hasScheduleToday = true,
  hasCompletedShift = false,
}) {
  return (
    <div className="card time-card">
      <div className="time-panel">
        <div className="time-counter">{counterDisplay}</div>

        {hasCompletedShift ? (
          <p className="time-complete-message">Thank you for your hard work.</p>
        ) : !hasScheduleToday ? (
          <p className="time-complete-message">No schedule for today.</p>
        ) : (
          <button
            type="button"
            className="time-in-btn"
            onClick={onToggleTimeIn}
            disabled={isButtonDisabled}
          >
            {hasActiveTimeIn ? "Time Out" : "Time In"}
          </button>
        )}

        <blockquote className="time-quote">
          <p className="time-quote-text">
            "Challenges are what make life interesting and overcoming them is what makes life meaningful."
          </p>
          <footer className="time-quote-author">Joshua J. Marine</footer>
        </blockquote>
      </div>
    </div>
  );
}

function AnnouncementCard({
  canEdit = true,
  announcements = [],
  isLoading = false,
  errorMessage = "",
  onCreateAnnouncement = null
}) {
  return (
    <div className="card announcement-card">
      <div className="card-top">
        <span>Announcement</span>
        {canEdit ? (
          <button
            type="button"
            className="pill-btn"
            onClick={onCreateAnnouncement}
          >
            + Announcement
          </button>
        ) : null}
      </div>
      <ul
        className="list-items announcement-list"
        aria-label={announcements.length > 0 ? "Announcements" : "No announcements yet"}
      >
        {isLoading ? (
          <li className="announcement-empty-state">Loading announcements...</li>
        ) : errorMessage ? (
          <li className="announcement-empty-state">{errorMessage}</li>
        ) : announcements.length > 0 ? (
          announcements.map(announcement => (
            <li
              key={announcement.announcement_id}
              className="announcement-item announcement-item-stacked"
            >
              <div className="announcement-title-row">
                <div className="announcement-title">{announcement.title}</div>
                <div className="announcement-meta">{announcement.date_posted}</div>
              </div>
              <div className="announcement-content">{announcement.content}</div>
              <div className="announcement-meta">
                Posted by {announcement.posted_by_name || "Unknown"}
              </div>
            </li>
          ))
        ) : (
          <li className="announcement-empty-state">No announcements yet.</li>
        )}
      </ul>
      <div className="mini-actions">{canEdit ? "✎\u00A0\u00A0" : null}◷</div>
    </div>
  );
}



function formatShiftTime(time, period) {
  if (!time) return "--";
  return `${time} ${period ?? ""}`.trim();
}

function getTodayShiftSchedule(schedule) {
  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) {
    return null;
  }

  const todayKey = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date().getDay()];
  const assignedDays = Array.isArray(schedule.days) ? schedule.days : [];
  if (assignedDays.length > 0 && !assignedDays.includes(todayKey)) {
    return null;
  }

  const daySchedule = schedule.daySchedules?.[todayKey];
  if (daySchedule && typeof daySchedule === "object") {
    return daySchedule;
  }

  return schedule;
}

function ShiftCard({ schedule = null, dashboardMeta = null }) {
  const shiftSchedule = getTodayShiftSchedule(schedule);
  const startTime = formatShiftTime(shiftSchedule?.startTime, shiftSchedule?.startPeriod);
  const endTime = formatShiftTime(shiftSchedule?.endTime, shiftSchedule?.endPeriod);
  const shiftDayName = new Date().toLocaleDateString("en-US", { weekday: "long" });

  return (
    <div className="card shift-card">
      <div className="card-top">
        <span>Current Shift</span>
        <span className="shift-day-name">{shiftDayName}</span>
      </div>
      <div className="shift-columns">
        <div className="shift-stat">
          <div className="label">Shift Start Time</div>
          <div className="value">{startTime}</div>
        </div>
        <div className="shift-stat">
          <div className="label">Shift End Time</div>
          <div className="value">{endTime}</div>
        </div>
      </div>
      <div className="shift-meta">
        <span className="shift-meta-pill">{dashboardMeta?.scheduleTag ?? "Not scheduled"}</span>
        <span className="shift-meta-break">Break: {dashboardMeta?.breakTime ?? "—"}</span>
      </div>
    </div>
  );
}

function CalendarCard({ calendarData, onPrevMonth, onNextMonth }) {
  return (
    <div className="card calendar-card" role="region" aria-label="Calendar">
      <div className="card-top">
        <button 
          type="button"
          className="calendar-nav-btn" 
          onClick={onPrevMonth}
          aria-label="Previous month"
          title="Previous month"
        >
          ◀
        </button>
        <span>Calendar</span>
        <button 
          type="button"
          className="calendar-nav-btn" 
          onClick={onNextMonth}
          aria-label="Next month"
          title="Next month"
        >
          ▶
        </button>
      </div>
      <div className="calendar-month-label" aria-live="polite">{calendarData.monthLabel}</div>
      <div className="calendar-grid weekdays" role="row">
        {calendarData.weekDays.map(weekday => (
          <div key={weekday} className="calendar-cell header" role="columnheader">{weekday}</div>
        ))}
      </div>
      <div className="calendar-grid dates">
        {calendarData.cells.map((cell, index) => (
          <div
            key={`${cell.day}-${index}`}
            className={`calendar-cell ${cell.muted ? "muted" : ""} ${cell.isToday ? "today" : ""}`}
            aria-current={cell.isToday ? "date" : undefined}
          >
            {cell.day}
          </div>
        ))}
      </div>
    </div>
  );
}

function HolidayCard({ canEdit = true }) {
  return (
    <div className="card holiday-card">
      <div className="card-top">
        <span>Holidays/Birthday</span>
        {canEdit ? <span className="plus">+</span> : null}
      </div>
      <ul className="list-items holiday-list" aria-label="No holidays or birthdays yet" />
      <div className="mini-actions">{canEdit ? "✎\u00A0\u00A0" : null}◷</div>
    </div>
  );
}


function SummaryCard({ timeInStart, totalHours, hasScheduleToday = true, dashboardMeta = null }) {
  const isPresent = Boolean(timeInStart);
  const availabilityLabel = !hasScheduleToday ? "Not Available" : (dashboardMeta?.availabilityLabel ?? "Available");
  const isAvailable = !/not\s+available|unavailable/i.test(availabilityLabel);
  const attendanceLabel = hasScheduleToday ? (isPresent ? "Present" : "Absent") : "Not Scheduled";
  const resolvedAttendanceTag = dashboardMeta?.attendanceTag;
  const attendanceTag = hasScheduleToday
    ? (resolvedAttendanceTag && resolvedAttendanceTag !== "Pending"
      ? resolvedAttendanceTag
      : (isPresent ? "On Time" : "Scheduled"))
    : "Not Scheduled";
  return (
    <div className="card summary-card">
      <div className="summary-section summary-section-status">
        <div className="summary-label">Today Status</div>
        <div className="summary-list">
          <div className="summary-row"><span>Time In</span><strong>{timeInStart ? timeInStart.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '--:--'}</strong></div>
          <div className="summary-row"><span>Break</span><strong>{dashboardMeta?.breakTag ?? "Break inactive"}</strong></div>
          <div className="summary-row">
            <span>Status</span>
            <strong className={`summary-status-value ${isAvailable ? "is-available" : "is-unavailable"}`}>
              <span className="summary-status-dot" aria-hidden="true" />
              {availabilityLabel}
            </strong>
          </div>
        </div>
      </div>
      <div className="summary-section">
        <div className="summary-label">Total Hours</div>
        <div className="big-value">{totalHours}h</div>
      </div>
      <div className="summary-section">
        <div className="summary-label">Attendance</div>
        <div className="big-value">{attendanceLabel}</div>
        <div className="summary-tag">{attendanceTag}</div>
      </div>
    </div>
  );
}

function isOpenFileRequest(request) {
  const normalizedStatus = String(request?.status ?? "").trim().toLowerCase();
  if (!normalizedStatus) return true;

  return normalizedStatus.includes("pending") || normalizedStatus.includes("endorsed");
}

function FileRequestCard({ requests = [], onViewRequest = null }) {
  const visibleRequests = Array.isArray(requests)
    ? requests.filter(isOpenFileRequest).slice(0, 3)
    : [];

  return (
    <div className="card member-card">
      <div className="member-title">File Request</div>
      <div
        className="request-list"
        aria-label={visibleRequests.length > 0 ? "Employee file requests" : "No file requests yet"}
      >
        {visibleRequests.length > 0 ? visibleRequests.map(request => (
          <div key={request.id} className="request-row">
            <span>{request.employee_name ?? "Employee"}</span>
            <span className="requesting">{request.request_type ?? "Request"}</span>
            <button type="button" className="view-btn" onClick={() => onViewRequest?.(request)}>
              View
            </button>
          </div>
        )) : (
          <div className="empty-state">No file requests yet.</div>
        )}
      </div>
    </div>
  );
}

export default function MainDashboard({
  attendanceControls = null,
  showMemberStatusCard = false,
  schedule = null,
  canEditCards = true,
  dashboardMeta = null,
  fileRequests = [],
  onViewFileRequests = null,
}) {
  const [timeInStart, setTimeInStart] = useState(null);
  const [now, setNow] = useState(new Date());
  const [isTimeOutConfirmOpen, setIsTimeOutConfirmOpen] = useState(false);
  const [displayDate, setDisplayDate] = useState(new Date());
  const [announcements, setAnnouncements] = useState([]);
  const [isLoadingAnnouncements, setIsLoadingAnnouncements] = useState(true);
  const [announcementError, setAnnouncementError] = useState("");
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementContent, setAnnouncementContent] = useState("");
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  const [announcementFormError, setAnnouncementFormError] = useState("");

  const loadAnnouncements = async () => {
    setIsLoadingAnnouncements(true);
    setAnnouncementError("");

    try {
      const response = await fetchAnnouncements();
      setAnnouncements(Array.isArray(response?.announcements) ? response.announcements : []);
    } catch (error) {
      setAnnouncements([]);
      setAnnouncementError(error?.error || "Unable to load announcements.");
    } finally {
      setIsLoadingAnnouncements(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadAnnouncements().catch(() => {
      if (isMounted) {
        setAnnouncementError("Unable to load announcements.");
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const activeTimeIn = attendanceControls?.timeInAt ?? timeInStart;
  const activeTimeOut = attendanceControls?.timeOutAt ?? null;
  const hasCompletedShift = Boolean(attendanceControls?.hasCompletedShift);
  const hasActiveTimeIn = Boolean(activeTimeIn && !activeTimeOut);
  const hasScheduleToday = Boolean(getTodayShiftSchedule(schedule));
  const canClickTimeIn = attendanceControls?.canClickTimeIn ?? (hasScheduleToday && !hasActiveTimeIn && !hasCompletedShift);
  const canClickTimeOut = attendanceControls?.canClickTimeOut ?? (hasActiveTimeIn && !hasCompletedShift);
  const canToggleTimeIn = hasActiveTimeIn ? canClickTimeOut : canClickTimeIn;

  const counterDisplay = useMemo(() => {
    if (!activeTimeIn) return "00:00:00";
    const counterEndTime = activeTimeOut ?? now;
    const diffInSeconds = Math.max(0, Math.floor((counterEndTime.getTime() - activeTimeIn.getTime()) / 1000));
    const hours = String(Math.floor(diffInSeconds / 3600)).padStart(2, "0");
    const minutes = String(Math.floor((diffInSeconds % 3600) / 60)).padStart(2, "0");
    const seconds = String(diffInSeconds % 60).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }, [activeTimeIn, activeTimeOut, now]);

  const calendarData = useMemo(() => {
    const currentDate = new Date();
    const year = displayDate.getFullYear();
    const month = displayDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const cells = [];
    for (let index = 0; index < firstDayOfMonth.getDay(); index += 1) {
      cells.push({ day: "", muted: true, isToday: false });
    }

    for (let day = 1; day <= lastDayOfMonth.getDate(); day += 1) {
      const isToday =
        day === currentDate.getDate() &&
        month === currentDate.getMonth() &&
        year === currentDate.getFullYear();
      cells.push({ day, muted: false, isToday });
    }

    return {
      monthLabel: displayDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
      weekDays,
      cells,
    };
  }, [displayDate]);


  const totalHours = useMemo(() => {
    if (!activeTimeIn) return 0;
    const counterEndTime = activeTimeOut ?? now;
    const diffInSeconds = Math.max(0, Math.floor((counterEndTime.getTime() - activeTimeIn.getTime()) / 1000));
    return (diffInSeconds / 3600).toFixed(1);
  }, [activeTimeIn, activeTimeOut, now]);

  const dateTimeLabel = useMemo(() => (
    `${now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit" })} `
    + `${now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`
  ), [now]);

  const executeTimeOut = () => {
    if (attendanceControls) {
      attendanceControls.onTimeOut();
      return;
    }

    setTimeInStart(null);
  };

  const handleConfirmTimeOut = () => {
    executeTimeOut();
    setIsTimeOutConfirmOpen(false);
  };

  const onToggleTimeIn = () => {
    if (hasCompletedShift) {
      return;
    }

    if (attendanceControls) {
      if (hasActiveTimeIn) {
        setIsTimeOutConfirmOpen(true);
        return;
      }

      if (!hasScheduleToday) {
        return;
      }

      attendanceControls.onTimeIn();
      return;
    }

    if (!hasScheduleToday) {
      return;
    }

    if (hasActiveTimeIn) {
      setIsTimeOutConfirmOpen(true);
      return;
    }

    setTimeInStart(new Date());
  };

  const handlePrevMonth = () => {
    setDisplayDate(prevDate => new Date(prevDate.getFullYear(), prevDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setDisplayDate(prevDate => new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 1));
  };

  const handleOpenAnnouncementModal = () => {
    setAnnouncementFormError("");
    setIsAnnouncementModalOpen(true);
  };

  const handleCloseAnnouncementModal = () => {
    setIsAnnouncementModalOpen(false);
    setAnnouncementTitle("");
    setAnnouncementContent("");
    setAnnouncementFormError("");
  };

  const handleCreateAnnouncement = async event => {
    event.preventDefault();

    const trimmedTitle = announcementTitle.trim();
    const trimmedContent = announcementContent.trim();

    if (!trimmedTitle || !trimmedContent) {
      setAnnouncementFormError("Title and content are required.");
      return;
    }

    setIsSavingAnnouncement(true);
    setAnnouncementFormError("");

    try {
      await createAnnouncement({
        title: trimmedTitle,
        content: trimmedContent
      });
      await loadAnnouncements();
      handleCloseAnnouncementModal();
    } catch (error) {
      setAnnouncementFormError(error?.error || "Unable to create announcement.");
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  return (
    <>
      <DashboardHeader dateTimeLabel={dateTimeLabel} />

      <div className={`dashboard-grid ${showMemberStatusCard ? "has-member-status" : "no-member-status"}`}>
        <TimeCard
          counterDisplay={counterDisplay}
          hasActiveTimeIn={hasActiveTimeIn}
          onToggleTimeIn={onToggleTimeIn}
          isButtonDisabled={!canToggleTimeIn}
          hasScheduleToday={hasScheduleToday}
          hasCompletedShift={hasCompletedShift}
        />
        <AnnouncementCard
          canEdit={canEditCards}
          announcements={announcements}
          isLoading={isLoadingAnnouncements}
          errorMessage={announcementError}
          onCreateAnnouncement={handleOpenAnnouncementModal}
        />
        <ShiftCard schedule={schedule} dashboardMeta={dashboardMeta} />
        <CalendarCard 
          calendarData={calendarData} 
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
        />
        <HolidayCard canEdit={canEditCards} />
        <SummaryCard
          timeInStart={activeTimeIn}
          totalHours={totalHours}
          hasScheduleToday={hasScheduleToday}
          dashboardMeta={dashboardMeta}
        />
        {showMemberStatusCard ? <FileRequestCard requests={fileRequests} onViewRequest={onViewFileRequests} /> : null}
      </div>

      {isTimeOutConfirmOpen ? (
        <div className="time-out-modal-backdrop" role="presentation">
          <div
            className="time-out-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="time-out-confirm-title"
          >
            <h3 id="time-out-confirm-title">Confirm Time Out</h3>
            <p>Are you sure you want to time out now?</p>
            <div className="time-out-modal-actions">
              <button type="button" className="time-out-cancel-btn" onClick={() => setIsTimeOutConfirmOpen(false)}>
                Cancel
              </button>
              <button type="button" className="time-out-confirm-btn" onClick={handleConfirmTimeOut}>
                Confirm Time Out
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isAnnouncementModalOpen ? (
        <div className="time-out-modal-backdrop" role="presentation">
          <div
            className="time-out-modal announcement-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="announcement-modal-title"
          >
            <h3 id="announcement-modal-title">Create Announcement</h3>
            <form onSubmit={handleCreateAnnouncement} className="announcement-form">
              <div className="announcement-form-field">
                <label htmlFor="ann-title">Title</label>
                <input
                  id="ann-title"
                  type="text"
                  value={announcementTitle}
                  onChange={event => setAnnouncementTitle(event.target.value)}
                  maxLength={100}
                  disabled={isSavingAnnouncement}
                  required
                />
              </div>
              <div className="announcement-form-field">
                <label htmlFor="ann-content">Content</label>
                <textarea
                  id="ann-content"
                  value={announcementContent}
                  onChange={event => setAnnouncementContent(event.target.value)}
                  rows={5}
                  disabled={isSavingAnnouncement}
                  required
                />
              </div>
              {announcementFormError ? (
                <p className="announcement-form-error" role="alert">{announcementFormError}</p>
              ) : null}
              <div className="time-out-modal-actions">
                <button
                  type="button"
                  className="time-out-cancel-btn"
                  onClick={handleCloseAnnouncementModal}
                  disabled={isSavingAnnouncement}
                >
                  Cancel
                </button>
                <button type="submit" className="time-out-confirm-btn" disabled={isSavingAnnouncement}>
                  {isSavingAnnouncement ? "Saving..." : "Post Announcement"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
