<?php
include __DIR__ . "/../../config/database.php";
include __DIR__ . "/../../config/auth.php";
requireRole("coach");

function hasTable(mysqli $conn, string $table): bool {
    $safe = $conn->real_escape_string($table);
    $result = $conn->query("SHOW TABLES LIKE '{$safe}'");
    return $result && $result->num_rows > 0;
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


function getRequesterRoleExpression(mysqli $conn, string $requesterIdExpr, bool $requesterIsUserId): string {
    if (!hasTable($conn, 'users')) {
        return "''";
    }

    $userColumns = getColumns($conn, 'users');
    $usersIdColumn = in_array('id', $userColumns, true) ? 'id' : (in_array('user_id', $userColumns, true) ? 'user_id' : null);
    $roleColumn = in_array('role', $userColumns, true) ? 'role' : null;
    $roleIdColumn = in_array('role_id', $userColumns, true) ? 'role_id' : null;

    if ($usersIdColumn === null) {
        return "''";
    }

    $userIdExpr = $requesterIsUserId
        ? $requesterIdExpr
        : "(SELECT employee_user.user_id FROM employees employee_user WHERE employee_user.employee_id = {$requesterIdExpr} LIMIT 1)";

    if ($roleColumn !== null) {
        return "LOWER(COALESCE((SELECT request_role_user.$roleColumn FROM users request_role_user WHERE request_role_user.$usersIdColumn = {$userIdExpr} LIMIT 1), ''))";
    }

    if ($roleIdColumn !== null && hasTable($conn, 'roles')) {
        $roleColumns = getColumns($conn, 'roles');
        $rolesIdColumn = in_array('role_id', $roleColumns, true) ? 'role_id' : null;
        $roleNameColumn = in_array('role_name', $roleColumns, true) ? 'role_name' : null;
        if ($rolesIdColumn !== null && $roleNameColumn !== null) {
            return "LOWER(COALESCE((SELECT request_role.$roleNameColumn FROM users request_role_user LEFT JOIN roles request_role ON request_role.$rolesIdColumn = request_role_user.$roleIdColumn WHERE request_role_user.$usersIdColumn = {$userIdExpr} LIMIT 1), ''))";
        }
    }

    return "''";
}

function getClusterMemberEmployeeReference(mysqli $conn): ?string {
    $sql = "SELECT REFERENCED_TABLE_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'cluster_members'
              AND COLUMN_NAME = 'employee_id'
              AND REFERENCED_TABLE_NAME IS NOT NULL
            LIMIT 1";

    $result = $conn->query($sql);
    if (!$result) {
        return null;
    }

    $row = $result->fetch_assoc();
    return $row['REFERENCED_TABLE_NAME'] ?? null;
}


function resolvePhotoSelect(mysqli $conn, string $table): string {
    if (!hasTable($conn, $table)) {
        return "NULL AS photo_path";
    }

    $columns = getColumns($conn, $table);
    foreach (['photo_path', 'photo_url', 'attachment_path', 'supporting_photo'] as $column) {
        if (in_array($column, $columns, true)) {
            return "req.$column AS photo_path";
        }
    }

    return "NULL AS photo_path";
}

$coachId = (int)($_SESSION['user']['id'] ?? 0);
$clusterColumns = getColumns($conn, 'clusters');
$userColumns = hasTable($conn, 'users') ? getColumns($conn, 'users') : [];
$employeeColumns = hasTable($conn, 'employees') ? getColumns($conn, 'employees') : [];
$requestEmployeeReference = getClusterMemberEmployeeReference($conn);
$clusterIdColumn = in_array('id', $clusterColumns, true) ? 'id' : 'cluster_id';
$clusterOwnerColumn = in_array('coach_id', $clusterColumns, true) ? 'coach_id' : 'user_id';

$usersIdColumn = in_array('id', $userColumns, true) ? 'id' : (in_array('user_id', $userColumns, true) ? 'user_id' : null);
$userDisplayColumn = in_array('fullname', $userColumns, true) ? 'fullname' : (in_array('username', $userColumns, true) ? 'username' : null);
$userSecondaryColumn = in_array('username', $userColumns, true) ? 'username' : (in_array('email', $userColumns, true) ? 'email' : null);
$canJoinEmployees = in_array('user_id', $employeeColumns, true) && in_array('employee_id', $employeeColumns, true);

$requestEmployeeExpr = 'req.employee_id';
$employeeJoinSql = '';
if ($requestEmployeeReference === 'users' && $canJoinEmployees) {
    $requestEmployeeExpr = 'COALESCE(emp.employee_id, req.employee_id)';
    $employeeJoinSql = ' LEFT JOIN employees emp ON emp.user_id = req.employee_id';
}

$employeeNameExpr = "CONCAT('Employee #', $requestEmployeeExpr)";
$employeeSecondaryExpr = "''";
$userJoinSql = '';
$employeeDetailsJoinSql = '';

$employeeNameColumns = array_values(array_filter([
    in_array('first_name', $employeeColumns, true) ? 'requester_employee.first_name' : null,
    in_array('last_name', $employeeColumns, true) ? 'requester_employee.last_name' : null,
]));

if (in_array('employee_id', $employeeColumns, true)) {
    if ($requestEmployeeReference === 'users' && in_array('user_id', $employeeColumns, true)) {
        $employeeDetailsJoinSql = ' LEFT JOIN employees requester_employee ON requester_employee.user_id = req.employee_id';
    } else {
        $employeeDetailsJoinSql = " LEFT JOIN employees requester_employee ON requester_employee.employee_id = $requestEmployeeExpr";
    }
}

$employeeFullNameExpr = count($employeeNameColumns) > 0
    ? "NULLIF(TRIM(CONCAT_WS(' ', " . implode(', ', $employeeNameColumns) . ")), '')"
    : "''";

if ($usersIdColumn !== null) {
    if ($requestEmployeeReference === 'users') {
        $userJoinSql = " LEFT JOIN users requester ON requester.$usersIdColumn = req.employee_id";
    } else {
        $userJoinSql = " LEFT JOIN users requester ON requester.$usersIdColumn = $requestEmployeeExpr";
    }

    $userDisplayExpr = $userDisplayColumn !== null
        ? "NULLIF(requester.$userDisplayColumn, '')"
        : "''";
    $userFallbackExpr = in_array('email', $userColumns, true)
        ? "NULLIF(requester.email, '')"
        : "''";

    $employeeNameExpr = "COALESCE($employeeFullNameExpr, $userDisplayExpr, $userFallbackExpr, CONCAT('Employee #', $requestEmployeeExpr))";

    if ($userSecondaryColumn !== null) {
        $employeeSecondaryExpr = "COALESCE(NULLIF(requester.$userSecondaryColumn, ''), '')";
    }
} else {
    $employeeNameExpr = "COALESCE($employeeFullNameExpr, CONCAT('Employee #', $requestEmployeeExpr))";
}

$items = [];

$loadRequests = function (string $table, string $idColumn, string $typeColumn, string $detailsColumn, string $scheduleExpr, string $alias, string $defaultType, string $extraJoinSql = '', string $extraWhereSql = '') use ($conn, $coachId, $clusterIdColumn, $clusterOwnerColumn, $requestEmployeeExpr, $employeeJoinSql, $employeeDetailsJoinSql, $userJoinSql, $employeeNameExpr, $employeeSecondaryExpr, &$items) {
    $photoSelect = resolvePhotoSelect($conn, $table);

    $sql = "SELECT DISTINCT
                req.$idColumn AS source_id,
                req.created_at AS filed_at,
                req.$typeColumn AS request_type,
                req.$detailsColumn AS details,
                $photoSelect,
                $scheduleExpr AS schedule_period,
                req.status,
                $requestEmployeeExpr AS employee_id,
                $employeeNameExpr AS employee_name,
                $employeeSecondaryExpr AS employee_username
            FROM $table req
            $employeeJoinSql
            $employeeDetailsJoinSql
            INNER JOIN cluster_members cm ON cm.employee_id = $requestEmployeeExpr
            INNER JOIN clusters c ON c.$clusterIdColumn = cm.cluster_id
            $userJoinSql
            $extraJoinSql
            WHERE c.$clusterOwnerColumn = ?
              AND c.status = 'active'
              $extraWhereSql";

    $stmt = $conn->prepare($sql);
    if (!$stmt) {
        return;
    }

    $stmt->bind_param('i', $coachId);
    $stmt->execute();
    $res = $stmt->get_result();

    while ($row = $res->fetch_assoc()) {
        $items[] = [
            'id' => $alias . '-' . $row['source_id'],
            'source_id' => (int)$row['source_id'],
            'request_source' => $alias,
            'date_filed' => $row['filed_at'],
            'request_type' => $row['request_type'] ?: $defaultType,
            'details' => $row['details'] ?: '—',
            'photo_path' => trim((string)($row['photo_path'] ?? '')),
            'schedule_period' => trim((string)$row['schedule_period']) ?: '—',
            'status' => $row['status'] ?: 'Pending',
            'employee_id' => (int)$row['employee_id'],
            'employee_name' => $row['employee_name'] ?: 'Employee',
            'employee_username' => trim((string)($row['employee_username'] ?? ''))
        ];
    }
};

if (hasTable($conn, 'leave_requests')) {
    $loadRequests(
        'leave_requests',
        'leave_id',
        'leave_type',
        'reason',
        "CONCAT(COALESCE(req.start_date, ''), CASE WHEN req.end_date IS NOT NULL THEN CONCAT(' to ', req.end_date) ELSE '' END)",
        'leave',
        'Leave'
    );
}

if (hasTable($conn, 'overtime_requests')) {
    $loadRequests(
        'overtime_requests',
        'ot_id',
        'ot_type',
        'purpose',
        "CONCAT(COALESCE(req.start_time, ''), CASE WHEN req.end_time IS NOT NULL THEN CONCAT(' to ', req.end_time) ELSE '' END)",
        'overtime',
        'Overtime'
    );
}

if (hasTable($conn, 'attendance_disputes')) {
    $requesterRoleExpr = getRequesterRoleExpression($conn, 'req.employee_id', $requestEmployeeReference === 'users');
    $disputeRoleCondition = " AND {$requesterRoleExpr} = 'employee'";

    $loadRequests(
        'attendance_disputes',
        'dispute_id',
        'dispute_type',
        'reason',
        'req.dispute_date',
        'dispute',
        'Attendance Dispute',
        '',
        $disputeRoleCondition
    );
}

usort($items, function ($a, $b) {
    return strtotime((string)$b['date_filed']) <=> strtotime((string)$a['date_filed']);
});

echo json_encode($items);