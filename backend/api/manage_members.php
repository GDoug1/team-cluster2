<?php
include "../config/database.php";
include "../config/auth.php";
requireRole("coach");

$cluster_id = isset($_GET['cluster_id']) ? (int)$_GET['cluster_id'] : 0;
if ($cluster_id <= 0) {
    http_response_code(400);
    exit(json_encode(["error" => "Invalid cluster id"]));
}

$attendance_date = isset($_GET['attendance_date']) ? trim($_GET['attendance_date']) : date('Y-m-d');

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $attendance_date)) {
    $attendance_date = date('Y-m-d');
}

function getColumns(mysqli $conn, string $table): array {
    $columns = [];
    $result = $conn->query("SHOW COLUMNS FROM $table");
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $columns[] = $row['Field'];
        }
    }
    return $columns;
}

$userColumns = getColumns($conn, 'users');
$employeeColumns = getColumns($conn, 'employees');
$scheduleColumns = getColumns($conn, 'schedules');
$attendanceColumns = getColumns($conn, 'attendance_logs');

$userIdColumn = in_array('id', $userColumns, true) ? 'id' : 'user_id';
$memberNameExpr = in_array('fullname', $userColumns, true)
    ? 'u.fullname'
    : "TRIM(CONCAT_WS(' ', e.first_name, e.middle_name, e.last_name))";

$scheduleSelect = in_array('schedule', $scheduleColumns, true) ? 's.schedule' : 'NULL';

$hasLegacyAttendance = in_array('id', $attendanceColumns, true)
    && in_array('time_in_at', $attendanceColumns, true)
    && in_array('time_out_at', $attendanceColumns, true)
    && in_array('tag', $attendanceColumns, true);

$hasNewAttendance = in_array('attendance_id', $attendanceColumns, true)
    && in_array('attendance_status', $attendanceColumns, true)
    && in_array('attendance_date', $attendanceColumns, true);

$escapedAttendanceDate = $conn->real_escape_string($attendance_date);

$attendanceJoin = 'NULL AS attendance_tag, NULL AS attendance_note, NULL AS time_in_at, NULL AS time_out_at';
if ($hasLegacyAttendance) {
    $attendanceJoin = "al.tag AS attendance_tag,
            al.note AS attendance_note,
            al.time_in_at,
            al.time_out_at";
} elseif ($hasNewAttendance) {
    $attendanceJoin = "al.attendance_status AS attendance_tag,
            al.note AS attendance_note,
            NULL AS time_in_at,
            NULL AS time_out_at";
}

$attendanceLeftJoin = '';
if ($hasLegacyAttendance) {
    $attendanceLeftJoin = "LEFT JOIN attendance_logs al
        ON al.id = (
            SELECT al2.id
            FROM attendance_logs al2
            WHERE al2.cluster_id = cm.cluster_id
              AND al2.employee_id = cm.employee_id
              AND DATE(COALESCE(al2.time_in_at, al2.time_out_at, al2.updated_at)) = '$escapedAttendanceDate'
            ORDER BY COALESCE(al2.time_in_at, al2.time_out_at, al2.updated_at) DESC, al2.id DESC
            LIMIT 1
        )";
} elseif ($hasNewAttendance) {
    $attendanceLeftJoin = "LEFT JOIN attendance_logs al
        ON al.attendance_id = (
            SELECT al2.attendance_id
            FROM attendance_logs al2
            WHERE al2.cluster_id = cm.cluster_id
              AND al2.employee_id = cm.employee_id
              AND al2.attendance_date = '$escapedAttendanceDate'
            ORDER BY al2.updated_at DESC, al2.attendance_id DESC
            LIMIT 1
        )";
}

$userJoin = in_array('user_id', $employeeColumns, true)
    ? "LEFT JOIN employees e ON e.user_id = u.$userIdColumn"
    : '';

$res = $conn->query(
    "SELECT u.$userIdColumn AS id,
            $memberNameExpr AS fullname,
            $scheduleSelect AS schedule,
            $attendanceJoin
     FROM cluster_members cm
     JOIN users u ON cm.employee_id = u.$userIdColumn
     $userJoin
     LEFT JOIN schedules s
        ON s.cluster_id = cm.cluster_id
        AND s.employee_id = cm.employee_id
     $attendanceLeftJoin
     WHERE cm.cluster_id=$cluster_id"
);

if (!$res) {
    http_response_code(500);
    exit(json_encode(["error" => "Unable to load team members."]));
}

$members = [];
while ($m = $res->fetch_assoc()) {
    $m['id'] = (int)$m['id'];
    $m['fullname'] = trim((string)$m['fullname']);
    if ($m['fullname'] === '') {
        $m['fullname'] = "Employee #{$m['id']}";
    }
    $m['attendance_history'] = [];
    $members[] = $m;
}

$historyByEmployee = [];
if ($hasLegacyAttendance) {
    $historyRes = $conn->query(
        "SELECT id,
                employee_id,
                DATE_FORMAT(COALESCE(time_in_at, time_out_at, updated_at), '%Y-%m') AS month_key,
                DATE_FORMAT(COALESCE(time_in_at, time_out_at, updated_at), '%M %Y') AS month_label,
                time_in_at,
                time_out_at,
                tag,
                note
         FROM attendance_logs
         WHERE cluster_id=$cluster_id
         ORDER BY COALESCE(time_in_at, time_out_at, updated_at) DESC, id DESC"
    );

    if ($historyRes) {
        while ($history = $historyRes->fetch_assoc()) {
            $employeeId = (int)$history['employee_id'];
            $monthKey = $history['month_key'];
            if (!isset($historyByEmployee[$employeeId][$monthKey])) {
                $historyByEmployee[$employeeId][$monthKey] = [
                    'month' => $history['month_label'],
                    'entries' => []
                ];
            }

    $historyByEmployee[$employeeId][$monthKey]['entries'][] = [
                'id' => (int)$history['id'],
                'time_in_at' => $history['time_in_at'],
                'time_out_at' => $history['time_out_at'],
                'tag' => $history['tag'],
                'note' => $history['note']
            ];
        }
    }
} elseif ($hasNewAttendance) {
    $historyRes = $conn->query(
        "SELECT attendance_id,
                employee_id,
                DATE_FORMAT(COALESCE(attendance_date, updated_at), '%Y-%m') AS month_key,
                DATE_FORMAT(COALESCE(attendance_date, updated_at), '%M %Y') AS month_label,
                attendance_status,
                note,
                attendance_date
         FROM attendance_logs
         WHERE cluster_id=$cluster_id
         ORDER BY COALESCE(attendance_date, updated_at) DESC, attendance_id DESC"
    );

    if ($historyRes) {
        while ($history = $historyRes->fetch_assoc()) {
            $employeeId = (int)$history['employee_id'];
            $monthKey = $history['month_key'];
            if (!isset($historyByEmployee[$employeeId][$monthKey])) {
                $historyByEmployee[$employeeId][$monthKey] = [
                    'month' => $history['month_label'],
                    'entries' => []
                ];
            }

            $historyByEmployee[$employeeId][$monthKey]['entries'][] = [
                'id' => (int)$history['attendance_id'],
                'time_in_at' => $history['attendance_date'],
                'time_out_at' => null,
                'tag' => $history['attendance_status'],
                'note' => $history['note']
            ];
        }
    }
}

foreach ($members as &$member) {
    $memberId = (int)$member['id'];
    if (isset($historyByEmployee[$memberId])) {
        $member['attendance_history'] = array_values($historyByEmployee[$memberId]);
    }
}
unset($member);

echo json_encode($members);