<?php
include __DIR__ . "/../../config/database.php";
include __DIR__ . "/../../config/auth.php";
requirePermission($conn, "Edit Attendance");

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
  if ($normalizedTag === 'absent') return 'Absent';
  if ($normalizedTag === 'late') return 'Late';
  if ($normalizedTag === 'on leave') return 'On Leave';
  if ($normalizedTag === 'overtime') return 'Overtime';
  if ($normalizedTag === 'on time') return 'Present';
  return 'Present';
}

function getEnumValues(mysqli $conn, string $table, string $column): array {
  $res = $conn->query("SHOW COLUMNS FROM $table LIKE '" . $conn->real_escape_string($column) . "'");
  if (!$res || $res->num_rows === 0) return [];

  $row = $res->fetch_assoc();
  $type = $row['Type'] ?? '';
  if (!preg_match('/^enum\((.*)\)$/i', $type, $matches)) return [];

  $inner = $matches[1] ?? '';
  if ($inner === '') return [];

  $parts = str_getcsv($inner, ',', "'", '\\');
  return array_values(array_filter(array_map(static fn($v) => trim((string)$v), $parts), static fn($v) => $v !== ''));
}

function normalizeToAllowedEnum(?string $value, array $allowedValues): ?string {
  if ($value === null) return null;
  $trimmed = trim($value);
  if ($trimmed === '') return null;
  if (count($allowedValues) === 0) return $trimmed;

  $allowedMap = [];
  foreach ($allowedValues as $allowedValue) {
    $allowedMap[strtolower($allowedValue)] = $allowedValue;
  }

  $lookup = strtolower($trimmed);
  return $allowedMap[$lookup] ?? null;
}

$data = json_decode(file_get_contents("php://input"), true);
$attendanceId = isset($data['attendance_id']) ? (int)$data['attendance_id'] : 0;
$timeInAt = $data['timeInAt'] ?? null;
$timeOutAt = $data['timeOutAt'] ?? null;
$tag = $data['tag'] ?? null;
$note = $data['note'] ?? "";
$employeeId = isset($data['employee_id']) ? (int)$data['employee_id'] : 0;

if ($attendanceId <= 0) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid attendance id."]);
  exit;
}

$attendanceColumns = getColumns($conn, 'attendance_logs');
$timeLogColumns = getColumns($conn, 'time_logs');

$hasLegacyAttendance = in_array('id', $attendanceColumns, true)
  && in_array('time_in_at', $attendanceColumns, true)
  && in_array('time_out_at', $attendanceColumns, true)
  && in_array('tag', $attendanceColumns, true);

$hasNewAttendance = in_array('attendance_id', $attendanceColumns, true)
  && in_array('attendance_status', $attendanceColumns, true)
  && in_array('attendance_date', $attendanceColumns, true);

$hasAttendanceUpdatedAt = in_array('updated_at', $attendanceColumns, true);
$attendanceUserColumn = in_array('employee_id', $attendanceColumns, true)
  ? 'employee_id'
  : (in_array('user_id', $attendanceColumns, true) ? 'user_id' : null);

$timeLogPrimaryKey = in_array('time_log_id', $timeLogColumns, true)
  ? 'time_log_id'
  : (in_array('id', $timeLogColumns, true) ? 'id' : null);

$hasTimeLogs = $timeLogPrimaryKey
  && in_array('attendance_id', $timeLogColumns, true)
  && in_array('time_in', $timeLogColumns, true);

$hasTimeLogTimeOut = in_array('time_out', $timeLogColumns, true);
$hasTimeLogTag = in_array('tag', $timeLogColumns, true);

$timeInSql = $timeInAt ? date("Y-m-d H:i:s", strtotime($timeInAt)) : null;
$timeOutSql = $timeOutAt ? date("Y-m-d H:i:s", strtotime($timeOutAt)) : null;

if ($timeInAt !== null && $timeInAt !== '' && !$timeInSql) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid time in value."]);
  exit;
}
if ($timeOutAt !== null && $timeOutAt !== '' && !$timeOutSql) {
  http_response_code(400);
  echo json_encode(["error" => "Invalid time out value."]);
  exit;
}
if ($timeInSql && $timeOutSql && strtotime($timeOutSql) < strtotime($timeInSql)) {
  http_response_code(400);
  echo json_encode(["error" => "Time out cannot be earlier than time in."]);
  exit;
}

$timeInValue = $timeInSql ? "'" . $conn->real_escape_string($timeInSql) . "'" : "NULL";
$timeOutValue = $timeOutSql ? "'" . $conn->real_escape_string($timeOutSql) . "'" : "NULL";
$tagValue = ($tag !== null && $tag !== '') ? "'" . $conn->real_escape_string($tag) . "'" : "NULL";
$noteValue = "'" . $conn->real_escape_string((string)$note) . "'";

if ($hasLegacyAttendance) {
  $recordFields = ['id'];
  if (in_array('employee_id', $attendanceColumns, true)) $recordFields[] = 'employee_id';
  if (in_array('user_id', $attendanceColumns, true)) $recordFields[] = 'user_id';
  $recordQuery = $conn->query("SELECT " . implode(', ', $recordFields) . " FROM attendance_logs WHERE id=$attendanceId LIMIT 1");
  if (!$recordQuery || $recordQuery->num_rows === 0) {
    http_response_code(404);
    echo json_encode(["error" => "Attendance record not found."]);
    exit;
  }

  $record = $recordQuery->fetch_assoc();
  $recordEmployeeId = isset($record['employee_id']) ? (int)$record['employee_id'] : (isset($record['user_id']) ? (int)$record['user_id'] : 0);
  if ($employeeId > 0 && $recordEmployeeId > 0 && $employeeId !== $recordEmployeeId) {
    http_response_code(409);
    echo json_encode(["error" => "Attendance record does not match the selected employee."]);
    exit;
  }

  $updateFields = [
    "time_in_at=$timeInValue",
    "time_out_at=$timeOutValue",
    "tag=$tagValue",
    "note=$noteValue"
  ];
  if ($hasAttendanceUpdatedAt) {
    $updateFields[] = "updated_at=CURRENT_TIMESTAMP";
  }

  $ok = $conn->query("UPDATE attendance_logs SET " . implode(', ', $updateFields) . " WHERE id=$attendanceId");
  if (!$ok) {
    http_response_code(500);
    echo json_encode(["error" => "Unable to update attendance record."]);
    exit;
  }

  $updatedRes = $conn->query("SELECT id AS attendance_id, time_in_at, time_out_at, tag AS attendance_tag, note AS attendance_note FROM attendance_logs WHERE id=$attendanceId LIMIT 1");
  $updatedAttendance = $updatedRes ? $updatedRes->fetch_assoc() : null;

  echo json_encode(["success" => true, "attendance" => $updatedAttendance]);
  exit;
}

if ($hasNewAttendance) {
  $recordQuery = $conn->query("SELECT attendance_id, " . ($attendanceUserColumn ? "$attendanceUserColumn AS employee_id" : "NULL AS employee_id") . " FROM attendance_logs WHERE attendance_id=$attendanceId LIMIT 1");
  if (!$recordQuery || $recordQuery->num_rows === 0) {
    http_response_code(404);
    echo json_encode(["error" => "Attendance record not found."]);
    exit;
  }

  $record = $recordQuery->fetch_assoc();
  $recordEmployeeId = isset($record['employee_id']) ? (int)$record['employee_id'] : 0;
  if ($employeeId > 0 && $recordEmployeeId > 0 && $employeeId !== $recordEmployeeId) {
    http_response_code(409);
    echo json_encode(["error" => "Attendance record does not match the selected employee."]);
    exit;
  }

  $attendanceStatusColumn = 'attendance_status';
  $allowedStatuses = getEnumValues($conn, 'attendance_logs', $attendanceStatusColumn);
  $normalizedStatus = normalizeToAllowedEnum(mapTagToAttendanceStatus($tag), $allowedStatuses);
  $statusValue = $normalizedStatus !== null
    ? "'" . $conn->real_escape_string($normalizedStatus) . "'"
    : 'NULL';

  $updateFields = [
    "$attendanceStatusColumn=$statusValue",
    "note=$noteValue"
  ];
  if ($hasAttendanceUpdatedAt) {
    $updateFields[] = "updated_at=CURRENT_TIMESTAMP";
  }

  $ok = $conn->query("UPDATE attendance_logs SET " . implode(', ', $updateFields) . " WHERE attendance_id=$attendanceId");
  if (!$ok) {
    http_response_code(500);
    echo json_encode(["error" => "Unable to update attendance record."]);
    exit;
  }

  if ($hasTimeLogs) {
    $timeLogQuery = $conn->query(
      "SELECT $timeLogPrimaryKey AS time_log_id FROM time_logs WHERE attendance_id=$attendanceId ORDER BY $timeLogPrimaryKey DESC LIMIT 1"
    );

    if ($timeLogQuery && $timeLogQuery->num_rows > 0) {
      $timeLog = $timeLogQuery->fetch_assoc();
      $timeLogFields = ["time_in=$timeInValue"];
      if ($hasTimeLogTimeOut) $timeLogFields[] = "time_out=$timeOutValue";
      if ($hasTimeLogTag) $timeLogFields[] = "tag=$tagValue";
      $ok = $conn->query("UPDATE time_logs SET " . implode(', ', $timeLogFields) . " WHERE $timeLogPrimaryKey=" . (int)$timeLog['time_log_id']);
      if (!$ok) {
        http_response_code(500);
        echo json_encode(["error" => "Unable to update attendance time log."]);
        exit;
      }
    }
  }

  if ($hasTimeLogs && $timeLogPrimaryKey) {
    $attendanceTagExpr = $hasTimeLogTag ? 'COALESCE(tl.tag, al.attendance_status)' : 'al.attendance_status';
    $updatedSelect = "SELECT al.attendance_id, tl.time_in AS time_in_at, tl.time_out AS time_out_at, $attendanceTagExpr AS attendance_tag, al.note AS attendance_note
      FROM attendance_logs al
      LEFT JOIN time_logs tl ON tl.$timeLogPrimaryKey = (
        SELECT t2.$timeLogPrimaryKey
        FROM time_logs t2
        WHERE t2.attendance_id = al.attendance_id
        ORDER BY t2.$timeLogPrimaryKey DESC
        LIMIT 1
      )
      WHERE al.attendance_id=$attendanceId
      LIMIT 1";
  } else {
    $updatedSelect = "SELECT attendance_id, NULL AS time_in_at, NULL AS time_out_at, attendance_status AS attendance_tag, note AS attendance_note
      FROM attendance_logs
      WHERE attendance_id=$attendanceId
      LIMIT 1";
  }
  $updatedRes = $conn->query($updatedSelect);
  $updatedAttendance = $updatedRes ? $updatedRes->fetch_assoc() : null;

  echo json_encode(["success" => true, "attendance" => $updatedAttendance]);
  exit;
}

http_response_code(500);
echo json_encode(["error" => "Attendance schema is not supported."]);
