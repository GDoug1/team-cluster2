<?php
include __DIR__ . "/../../config/database.php";
include __DIR__ . "/../../config/auth.php";
requireRoleOrPermission(["super admin", "admin"], $conn, "Set Attendance");

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

function mapTagToAttendanceStatus(?string $tag): string {
    $normalizedTag = strtolower(trim((string)$tag));
    if ($normalizedTag === 'late') return 'Late';
    if ($normalizedTag === 'overtime') return 'Overtime';
    if ($normalizedTag === 'on leave') return 'On Leave';
    return 'Present';
}

$data = json_decode(file_get_contents("php://input"), true);
$currentUserId = (int)($_SESSION['user']['id'] ?? 0);
$timeInAt = $data['timeInAt'] ?? null;
$timeOutAt = $data['timeOutAt'] ?? null;
$tag = $data['tag'] ?? null;
$note = $data['note'] ?? '';

if ($currentUserId <= 0) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit;
}

$employeeStmt = $conn->prepare("SELECT employee_id FROM employees WHERE user_id = ? LIMIT 1");
if (!$employeeStmt) {
    http_response_code(500);
    echo json_encode(["error" => "Unable to resolve employee profile."]);
    exit;
}
$employeeStmt->bind_param('i', $currentUserId);
$employeeStmt->execute();
$employeeResult = $employeeStmt->get_result();
$employeeRow = $employeeResult ? $employeeResult->fetch_assoc() : null;
$employeeId = isset($employeeRow['employee_id']) ? (int)$employeeRow['employee_id'] : 0;

if ($employeeId <= 0) {
    http_response_code(400);
    echo json_encode(["error" => "Employee profile not found for the current account."]);
    exit;
}

$attendanceColumns = getColumns($conn, 'attendance_logs');
$timeLogColumns = getColumns($conn, 'time_logs');
$timeLogPrimaryKey = in_array('time_log_id', $timeLogColumns, true)
    ? 'time_log_id'
    : (in_array('id', $timeLogColumns, true) ? 'id' : null);
$timeLogOrderColumn = $timeLogPrimaryKey
    ?? (in_array('updated_at', $timeLogColumns, true)
        ? 'updated_at'
        : (in_array('time_in', $timeLogColumns, true) ? 'time_in' : null));
$hasNewAttendance = in_array('attendance_id', $attendanceColumns, true)
    && in_array('attendance_status', $attendanceColumns, true)
    && in_array('attendance_date', $attendanceColumns, true);
$hasTimeLogs = in_array('attendance_id', $timeLogColumns, true)
    && in_array('time_in', $timeLogColumns, true);
$hasTimeLogTimeOut = in_array('time_out', $timeLogColumns, true);
$hasTimeLogEmployee = in_array('employee_id', $timeLogColumns, true);
$hasTimeLogUser = in_array('user_id', $timeLogColumns, true);
$hasTimeLogDate = in_array('log_date', $timeLogColumns, true);
$hasTimeLogTag = in_array('tag', $timeLogColumns, true);

if (!$hasNewAttendance) {
    http_response_code(500);
    echo json_encode(["error" => "Attendance schema is not supported."]);
    exit;
}

$timeInSql = $timeInAt ? date("Y-m-d H:i:s", strtotime($timeInAt)) : null;
$timeOutSql = $timeOutAt ? date("Y-m-d H:i:s", strtotime($timeOutAt)) : null;
$attendanceDate = $timeInSql ? date('Y-m-d', strtotime($timeInSql)) : ($timeOutSql ? date('Y-m-d', strtotime($timeOutSql)) : date('Y-m-d'));
$attendanceDateEscaped = "'" . $conn->real_escape_string($attendanceDate) . "'";
$timeInValue = $timeInSql ? "'" . $conn->real_escape_string($timeInSql) . "'" : "NULL";
$timeOutValue = $timeOutSql ? "'" . $conn->real_escape_string($timeOutSql) . "'" : "NULL";
$tagValue = $tag ? "'" . $conn->real_escape_string($tag) . "'" : "NULL";
$noteValue = "'" . $conn->real_escape_string((string)$note) . "'";
$attendanceStatusEscaped = "'" . $conn->real_escape_string(mapTagToAttendanceStatus($tag)) . "'";

$existingAttendanceQuery = $conn->query(
    "SELECT attendance_id
     FROM attendance_logs
     WHERE employee_id = $employeeId
       AND attendance_date = $attendanceDateEscaped
     ORDER BY attendance_id DESC
     LIMIT 1"
);

$attendanceId = null;
if ($existingAttendanceQuery && $existingAttendanceQuery->num_rows > 0) {
    $attendanceId = (int)$existingAttendanceQuery->fetch_assoc()['attendance_id'];
    $conn->query(
        "UPDATE attendance_logs
         SET attendance_status = $attendanceStatusEscaped,
             note = $noteValue,
             updated_at = CURRENT_TIMESTAMP
         WHERE attendance_id = $attendanceId"
    );
} else {
    $conn->query(
        "INSERT INTO attendance_logs (cluster_id, employee_id, note, attendance_date, attendance_status)
         VALUES (NULL, $employeeId, $noteValue, $attendanceDateEscaped, $attendanceStatusEscaped)"
    );
    $attendanceId = (int)$conn->insert_id;
}

if ($hasTimeLogs && $attendanceId > 0) {
    if ($timeOutSql) {
        $existingTimeLogSql = "SELECT " . ($timeLogPrimaryKey ?? 'attendance_id') . " AS time_log_key
             FROM time_logs
             WHERE attendance_id = $attendanceId";
        if ($hasTimeLogEmployee) {
            $existingTimeLogSql .= " AND employee_id = $employeeId";
        }
        if ($hasTimeLogTimeOut) {
            $existingTimeLogSql .= " AND time_out IS NULL";
        }
        if ($timeLogOrderColumn) {
            $existingTimeLogSql .= " ORDER BY $timeLogOrderColumn DESC";
        }
        $existingTimeLogSql .= " LIMIT 1";

        $existingTimeLogQuery = $conn->query($existingTimeLogSql);
        if ($existingTimeLogQuery && $existingTimeLogQuery->num_rows > 0) {
            $timeLogKey = (int)$existingTimeLogQuery->fetch_assoc()['time_log_key'];
            $updates = [];
            if ($hasTimeLogTimeOut) {
                $updates[] = "time_out = $timeOutValue";
            }
            if ($hasTimeLogTag) {
                $updates[] = "tag = $tagValue";
            }
            if (count($updates) > 0 && $timeLogPrimaryKey) {
                $conn->query(
                    "UPDATE time_logs
                     SET " . implode(', ', $updates) . "
                     WHERE $timeLogPrimaryKey = $timeLogKey"
                );
            }
        }
    } elseif ($timeInSql) {
        $existingTimeInQuery = $conn->query(
            "SELECT " . ($timeLogPrimaryKey ?? 'attendance_id') . "
             FROM time_logs
             WHERE attendance_id = $attendanceId
             LIMIT 1"
        );

        if ($existingTimeInQuery && $existingTimeInQuery->num_rows > 0) {
            http_response_code(409);
            echo json_encode(["error" => "You can only time in once per day."]);
            exit;
        }

        $insertColumns = ['attendance_id', 'time_in'];
        $insertValues = [$attendanceId, $timeInValue];
        if ($hasTimeLogEmployee) {
            $insertColumns[] = 'employee_id';
            $insertValues[] = $employeeId;
        }
        if ($hasTimeLogUser) {
            $insertColumns[] = 'user_id';
            $insertValues[] = $currentUserId;
        }
        if ($hasTimeLogDate) {
            $insertColumns[] = 'log_date';
            $insertValues[] = $attendanceDateEscaped;
        }
        if ($hasTimeLogTag) {
            $insertColumns[] = 'tag';
            $insertValues[] = $tagValue;
        }

        $conn->query(
            "INSERT INTO time_logs (" . implode(', ', $insertColumns) . ")
             VALUES (" . implode(', ', $insertValues) . ")"
        );
    }
}

echo json_encode([
    'success' => true,
    'attendance' => [
        'timeInAt' => $timeInSql,
        'timeOutAt' => $timeOutSql,
        'tag' => $tag,
        'note' => $note,
    ]
]);
