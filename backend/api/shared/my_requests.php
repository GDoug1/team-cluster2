<?php
include __DIR__ . "/../../config/database.php";
include __DIR__ . "/../../config/auth.php";
requirePermission($conn, "View Attendance");

function hasTable(mysqli $conn, string $table): bool {
    $safe = $conn->real_escape_string($table);
    $result = $conn->query("SHOW TABLES LIKE '{$safe}'");
    return $result && $result->num_rows > 0;
}

function hasColumn(mysqli $conn, string $table, string $column): bool {
    $safeTable = $conn->real_escape_string($table);
    $safeColumn = $conn->real_escape_string($column);
    $result = $conn->query("SHOW COLUMNS FROM `{$safeTable}` LIKE '{$safeColumn}'");
    return $result && $result->num_rows > 0;
}

function resolveRequestActorName(mysqli $conn, ?int $userId): string {
    if (($userId ?? 0) <= 0 || !hasTable($conn, 'users')) {
        return '';
    }

    $userId = (int)$userId;
    $nameParts = [];

    if (hasTable($conn, 'employees') && hasColumn($conn, 'employees', 'user_id')) {
        $nameColumns = [];
        foreach (['first_name', 'last_name'] as $column) {
            if (hasColumn($conn, 'employees', $column)) {
                $nameColumns[] = "NULLIF(TRIM($column), '')";
            }
        }

        if (count($nameColumns) > 0) {
            $sql = "SELECT TRIM(CONCAT_WS(' ', " . implode(', ', $nameColumns) . ")) AS fullname FROM employees WHERE user_id = ? LIMIT 1";
            $stmt = $conn->prepare($sql);
            if ($stmt) {
                $stmt->bind_param('i', $userId);
                $stmt->execute();
                $result = $stmt->get_result();
                if ($result && $result->num_rows > 0) {
                    $nameParts[] = trim((string)($result->fetch_assoc()['fullname'] ?? ''));
                }
            }
        }
    }

    $userColumns = [];
    $userColumnsResult = $conn->query("SHOW COLUMNS FROM users");
    if ($userColumnsResult) {
        while ($row = $userColumnsResult->fetch_assoc()) {
            $userColumns[] = $row['Field'];
        }
    }
    $idColumn = in_array('id', $userColumns, true) ? 'id' : (in_array('user_id', $userColumns, true) ? 'user_id' : null);
    if ($idColumn !== null) {
        $fallbackColumns = [];
        foreach (['fullname', 'username', 'email'] as $column) {
            if (in_array($column, $userColumns, true)) {
                $fallbackColumns[] = "NULLIF(TRIM($column), '')";
            }
        }
        if (count($fallbackColumns) > 0) {
            $sql = "SELECT COALESCE(" . implode(', ', $fallbackColumns) . ", '') AS display_name FROM users WHERE $idColumn = ? LIMIT 1";
            $stmt = $conn->prepare($sql);
            if ($stmt) {
                $stmt->bind_param('i', $userId);
                $stmt->execute();
                $result = $stmt->get_result();
                if ($result && $result->num_rows > 0) {
                    $nameParts[] = trim((string)($result->fetch_assoc()['display_name'] ?? ''));
                }
            }
        }
    }

    foreach ($nameParts as $name) {
        if ($name !== '') {
            return $name;
        }
    }

    return '';
}

function resolveRequestActor(mysqli $conn, string $table, array $row): array {
    $status = strtolower(trim((string)($row['status'] ?? '')));
    $reviewedBy = isset($row['reviewed_by']) ? (int)$row['reviewed_by'] : 0;
    $approvedBy = isset($row['approved_by']) ? (int)$row['approved_by'] : 0;

    $actorId = 0;
    if (in_array($status, ['approved', 'denied'], true)) {
        $actorId = $approvedBy > 0 ? $approvedBy : $reviewedBy;
    } elseif ($status === 'endorsed') {
        $actorId = $reviewedBy;
    } elseif (strpos($status, 'reject') !== false) {
        $actorId = $reviewedBy > 0 ? $reviewedBy : $approvedBy;
    }

    return [
        'request_action_by_name' => resolveRequestActorName($conn, $actorId),
        'request_action_by_role' => $actorId > 0 ? ($table === 'leave_requests' && $status === 'endorsed' ? 'Coach' : '') : ''
    ];
}

function resolveLeavePhotoColumn(mysqli $conn): ?string {
    foreach (['photo_path', 'photo_url', 'attachment_path', 'supporting_photo'] as $column) {
        if (hasColumn($conn, 'leave_requests', $column)) {
            return $column;
        }
    }

    return null;
}

$leavePhotoColumn = resolveLeavePhotoColumn($conn);

$sessionUserId = (int)($_SESSION['user']['id'] ?? 0);
$employeeId = $sessionUserId;

if (hasTable($conn, 'employees') && hasColumn($conn, 'employees', 'user_id') && hasColumn($conn, 'employees', 'employee_id')) {
    $stmt = $conn->prepare("SELECT employee_id FROM employees WHERE user_id = ? LIMIT 1");
    $stmt->bind_param('i', $sessionUserId);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($result && $result->num_rows > 0) {
        $employeeId = (int)$result->fetch_assoc()['employee_id'];
    }
}

$items = [];

if (hasTable($conn, 'leave_requests')) {
    $stmt = $conn->prepare(
        "SELECT
            leave_id AS source_id,
            created_at AS filed_at,
            leave_type AS request_type,
            reason AS details,
            " . ($leavePhotoColumn !== null ? $leavePhotoColumn : "NULL") . " AS photo_path,
            CONCAT(COALESCE(start_date, ''), CASE WHEN end_date IS NOT NULL THEN CONCAT(' to ', end_date) ELSE '' END) AS schedule_period,
            status,
            reviewed_by,
            approved_by
         FROM leave_requests
         WHERE employee_id = ?"
    );
    $stmt->bind_param('i', $employeeId);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $actor = resolveRequestActor($conn, 'leave_requests', $row);
        $items[] = [
            'id' => 'leave-' . $row['source_id'],
            'request_source' => 'leave',
            'date_filed' => $row['filed_at'],
            'request_type' => $row['request_type'] ?: 'Leave',
            'details' => $row['details'] ?: '—',
            'photo_path' => trim((string)($row['photo_path'] ?? '')),
            'schedule_period' => trim((string)$row['schedule_period']) ?: '—',
            'status' => $row['status'] ?: 'Pending',
            'request_action_by_name' => $actor['request_action_by_name'],
            'request_action_by_role' => $actor['request_action_by_role']
        ];
    }
}

if (hasTable($conn, 'overtime_requests')) {
    $stmt = $conn->prepare(
        "SELECT
            ot_id AS source_id,
            created_at AS filed_at,
            ot_type AS request_type,
            purpose AS details,
            CONCAT(COALESCE(start_time, ''), CASE WHEN end_time IS NOT NULL THEN CONCAT(' to ', end_time) ELSE '' END) AS schedule_period,
            status,
            approved_by
         FROM overtime_requests
         WHERE employee_id = ?"
    );
    $stmt->bind_param('i', $employeeId);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $actorName = resolveRequestActorName($conn, isset($row['approved_by']) ? (int)$row['approved_by'] : 0);
        $items[] = [
            'id' => 'ot-' . $row['source_id'],
            'request_source' => 'overtime',
            'date_filed' => $row['filed_at'],
            'request_type' => $row['request_type'] ?: 'Overtime',
            'details' => $row['details'] ?: '—',
            'photo_path' => trim((string)($row['photo_path'] ?? '')),
            'schedule_period' => trim((string)$row['schedule_period']) ?: '—',
            'status' => $row['status'] ?: 'Pending',
            'request_action_by_name' => $actorName,
            'request_action_by_role' => ''
        ];
    }
}

if (hasTable($conn, 'attendance_disputes')) {
    $stmt = $conn->prepare(
        "SELECT
            dispute_id AS source_id,
            created_at AS filed_at,
            dispute_type AS request_type,
            reason AS details,
            dispute_date AS schedule_period,
            status
         FROM attendance_disputes
         WHERE employee_id = ?"
    );
    $stmt->bind_param('i', $employeeId);
    $stmt->execute();
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
        $items[] = [
            'id' => 'dispute-' . $row['source_id'],
            'request_source' => 'dispute',
            'date_filed' => $row['filed_at'],
            'request_type' => $row['request_type'] ?: 'Attendance Dispute',
            'details' => $row['details'] ?: '—',
            'schedule_period' => $row['schedule_period'] ?: '—',
            'status' => $row['status'] ?: 'Pending',
            'request_action_by_name' => '',
            'request_action_by_role' => ''
        ];
    }
}

usort($items, function ($a, $b) {
    $left = strtotime((string)($a['date_filed'] ?? ''));
    $right = strtotime((string)($b['date_filed'] ?? ''));
    return $right <=> $left;
});

echo json_encode($items);