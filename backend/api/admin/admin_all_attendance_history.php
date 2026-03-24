<?php
include __DIR__ . "/../../config/database.php";
include __DIR__ . "/../../config/auth.php";
requirePermission($conn, "View Attendance");

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

$currentUserId = isset($_SESSION['user']['id']) ? (int)$_SESSION['user']['id'] : 0;

$clusterColumns = getColumns($conn, 'clusters');
$userColumns = getColumns($conn, 'users');
$attendanceColumns = getColumns($conn, 'attendance_logs');
$timeLogColumns = getColumns($conn, 'time_logs');

$clusterIdColumn = in_array('id', $clusterColumns, true) ? 'id' : 'cluster_id';
$userIdColumn = in_array('id', $userColumns, true) ? 'id' : 'user_id';
$attendanceUserColumn = in_array('employee_id', $attendanceColumns, true) ? 'employee_id' : (in_array('user_id', $attendanceColumns, true) ? 'user_id' : null);
$attendancePrimaryKey = in_array('attendance_id', $attendanceColumns, true) ? 'attendance_id' : (in_array('id', $attendanceColumns, true) ? 'id' : null);
$userRoleColumn = in_array('role', $userColumns, true) ? 'role' : (in_array('role_id', $userColumns, true) ? 'role_id' : null);
$coachRoleExpr = '0=1';
if ($userRoleColumn === 'role') {
    $coachRoleExpr = "LOWER(COALESCE(u.role, '')) LIKE '%coach%'";
} elseif ($userRoleColumn === 'role_id') {
    $coachRoleExpr = "EXISTS (SELECT 1 FROM roles r WHERE r.role_id = u.role_id AND LOWER(r.role_name) LIKE '%coach%')";
}
$attendanceOwnerExpr = $attendanceUserColumn === 'employee_id'
    ? "COALESCE(e.employee_id, u.$userIdColumn)"
    : "u.$userIdColumn";

$hasLegacyAttendance = in_array('id', $attendanceColumns, true)
    && in_array('time_in_at', $attendanceColumns, true)
    && in_array('time_out_at', $attendanceColumns, true)
    && in_array('tag', $attendanceColumns, true);
$hasNewAttendance = in_array('attendance_id', $attendanceColumns, true)
    && in_array('attendance_status', $attendanceColumns, true)
    && in_array('attendance_date', $attendanceColumns, true);

$hasTimeLogs = in_array('attendance_id', $timeLogColumns, true)
    && in_array('time_in', $timeLogColumns, true);
$hasTimeLogTag = in_array('tag', $timeLogColumns, true);
$timeLogPrimaryKey = in_array('time_log_id', $timeLogColumns, true) ? 'time_log_id' : (in_array('id', $timeLogColumns, true) ? 'id' : null);
$timeLogOrderColumn = $timeLogPrimaryKey
    ?? (in_array('updated_at', $timeLogColumns, true)
        ? 'updated_at'
        : (in_array('time_in', $timeLogColumns, true) ? 'time_in' : null));

$attendanceUserColumn = in_array('employee_id', $attendanceColumns, true) ? 'employee_id' : (in_array('user_id', $attendanceColumns, true) ? 'user_id' : null);
$attendancePrimaryKey = in_array('attendance_id', $attendanceColumns, true) ? 'attendance_id' : (in_array('id', $attendanceColumns, true) ? 'id' : null);

if ($attendanceUserColumn === null || $attendancePrimaryKey === null) {
    // If we can't find the columns in attendance_logs, we still want to show users
    $attendanceSelect = 'NULL AS attendance_id, NULL AS time_in_at, NULL AS time_out_at, NULL AS attendance_tag, NULL AS attendance_note, NULL AS attendance_updated_at';
    $attendanceJoin = '';
    $orderBy = "u.$userIdColumn DESC";
} else {
    $attendanceOwnerExpr = $attendanceUserColumn === 'employee_id'
        ? "COALESCE(e.employee_id, u.$userIdColumn)"
        : "u.$userIdColumn";

    $hasLegacyAttendance = in_array('time_in_at', $attendanceColumns, true)
        && in_array('time_out_at', $attendanceColumns, true);
    
    $hasNewAttendance = in_array('attendance_id', $attendanceColumns, true)
        && in_array('attendance_status', $attendanceColumns, true);

    if ($hasLegacyAttendance) {
        $attendanceSelect = "al.$attendancePrimaryKey AS attendance_id, al.time_in_at, al.time_out_at, al.tag AS attendance_tag, al.note AS attendance_note, al.updated_at AS attendance_updated_at";
        $attendanceJoin = "LEFT JOIN attendance_logs al ON al.$attendanceUserColumn = $attendanceOwnerExpr";
        $orderBy = "COALESCE(al.time_in_at, al.updated_at) DESC, al.$attendancePrimaryKey DESC";
    } elseif ($hasNewAttendance) {
        $attendanceTagExpr = $hasTimeLogs && $hasTimeLogTag ? 'COALESCE(tl.tag, al.attendance_status)' : 'al.attendance_status';
        $attendanceSelect = "al.attendance_id AS attendance_id, tl.time_in AS time_in_at, tl.time_out AS time_out_at, $attendanceTagExpr AS attendance_tag, al.note AS attendance_note, al.updated_at AS attendance_updated_at";
        $attendanceJoin = "LEFT JOIN attendance_logs al ON al.$attendanceUserColumn = $attendanceOwnerExpr";

        if ($hasTimeLogs && $timeLogPrimaryKey) {
            $attendanceJoin .= "\nLEFT JOIN time_logs tl
                ON tl.$timeLogPrimaryKey = (
                    SELECT t2.$timeLogPrimaryKey
                    FROM time_logs t2
                    WHERE t2.attendance_id = al.attendance_id
                    " . ($timeLogOrderColumn ? "ORDER BY t2.$timeLogOrderColumn DESC" : '') . "
                    LIMIT 1
                )";
        }
        $orderBy = "COALESCE(al.attendance_date, al.updated_at) DESC, al.attendance_id DESC";
    } else {
        $attendanceSelect = 'NULL AS attendance_id, NULL AS time_in_at, NULL AS time_out_at, NULL AS attendance_tag, NULL AS attendance_note, NULL AS attendance_updated_at';
        $attendanceJoin = '';
        $orderBy = "u.$userIdColumn DESC";
    }
}

$sql = "SELECT u.$userIdColumn AS user_id,
               COALESCE(NULLIF(CONCAT_WS(' ', e.first_name, e.middle_name, e.last_name), ''), u.email) AS employee_name,
               c.name AS cluster_name,
               $attendanceSelect
        FROM users u
        LEFT JOIN employees e ON e.user_id = u.$userIdColumn
        $attendanceJoin
        LEFT JOIN clusters c ON c.$clusterIdColumn = al.cluster_id
        WHERE u.$userIdColumn <> $currentUserId
        ORDER BY $orderBy";

$res = $conn->query($sql);
if (!$res) {
    http_response_code(500);
    echo json_encode(["error" => "Unable to load attendance records."]);
    exit;
}

$rows = [];
while ($row = $res->fetch_assoc()) {
    $row['user_id'] = (int)$row['user_id'];
    $row['attendance_id'] = isset($row['attendance_id']) ? (int)$row['attendance_id'] : null;
    $rows[] = $row;
}

echo json_encode($rows);