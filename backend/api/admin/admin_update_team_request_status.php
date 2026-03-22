<?php
include __DIR__ . "/../../config/database.php";
include __DIR__ . "/../../config/auth.php";
include __DIR__ . "/../utils/logger.php";
requireRole(["admin", "super admin"]);


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

function getUserRoleByReference(mysqli $conn, int $referenceId, bool $referenceIsUserId): string {
    if ($referenceId <= 0 || !hasTable($conn, 'users')) {
        return '';
    }

    $userId = $referenceId;
    if (!$referenceIsUserId) {
        if (!hasTable($conn, 'employees')) {
            return '';
        }

        $employeeColumns = getColumns($conn, 'employees');
        if (!in_array('employee_id', $employeeColumns, true) || !in_array('user_id', $employeeColumns, true)) {
            return '';
        }

        $employeeStmt = $conn->prepare("SELECT user_id FROM employees WHERE employee_id = ? LIMIT 1");
        if (!$employeeStmt) {
            return '';
        }
        $employeeStmt->bind_param('i', $referenceId);
        $employeeStmt->execute();
        $employeeResult = $employeeStmt->get_result();
        if (!$employeeResult || $employeeResult->num_rows === 0) {
            return '';
        }
        $userId = (int)($employeeResult->fetch_assoc()['user_id'] ?? 0);
    }

    if ($userId <= 0) {
        return '';
    }

    $userColumns = getColumns($conn, 'users');
    $usersIdColumn = in_array('id', $userColumns, true) ? 'id' : (in_array('user_id', $userColumns, true) ? 'user_id' : null);
    $roleColumn = in_array('role', $userColumns, true) ? 'role' : null;
    $roleIdColumn = in_array('role_id', $userColumns, true) ? 'role_id' : null;

    if ($usersIdColumn === null) {
        return '';
    }

    if ($roleColumn !== null) {
        $stmt = $conn->prepare("SELECT LOWER(COALESCE($roleColumn, '')) AS role_name FROM users WHERE $usersIdColumn = ? LIMIT 1");
        if ($stmt) {
            $stmt->bind_param('i', $userId);
            $stmt->execute();
            $result = $stmt->get_result();
            if ($result && $result->num_rows > 0) {
                return (string)($result->fetch_assoc()['role_name'] ?? '');
            }
        }
        return '';
    }

    if ($roleIdColumn !== null && hasTable($conn, 'roles')) {
        $roleColumns = getColumns($conn, 'roles');
        $rolesIdColumn = in_array('role_id', $roleColumns, true) ? 'role_id' : null;
        $roleNameColumn = in_array('role_name', $roleColumns, true) ? 'role_name' : null;
        if ($rolesIdColumn !== null && $roleNameColumn !== null) {
            $stmt = $conn->prepare("SELECT LOWER(COALESCE(r.$roleNameColumn, '')) AS role_name FROM users u LEFT JOIN roles r ON r.$rolesIdColumn = u.$roleIdColumn WHERE u.$usersIdColumn = ? LIMIT 1");
            if ($stmt) {
                $stmt->bind_param('i', $userId);
                $stmt->execute();
                $result = $stmt->get_result();
                if ($result && $result->num_rows > 0) {
                    return (string)($result->fetch_assoc()['role_name'] ?? '');
                }
            }
        }
    }

    return '';
}

function getEmployeeReferenceTable(mysqli $conn, string $table): ?string {
    $safeTable = $conn->real_escape_string($table);
    $sql = "SELECT REFERENCED_TABLE_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = '{$safeTable}'
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

$body = json_decode(file_get_contents("php://input"), true);
if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid request payload."]);
    exit;
}

$source = trim((string)($body['request_source'] ?? ''));
$requestId = (int)($body['request_id'] ?? 0);
$status = trim((string)($body['status'] ?? ''));
$adminId = (int)($_SESSION['user']['id'] ?? 0);

if ($status === 'Rejected') {
    $status = 'Denied';
}

if (!in_array($source, ['leave', 'overtime', 'dispute'], true) || $requestId <= 0 || !in_array($status, ['Approved', 'Denied'], true)) {
    http_response_code(422);
    echo json_encode(["error" => "Invalid request update payload."]);
    exit;
}

$map = [
    'leave' => ['table' => 'leave_requests', 'id' => 'leave_id'],
    'overtime' => ['table' => 'overtime_requests', 'id' => 'ot_id'],
    'dispute' => ['table' => 'attendance_disputes', 'id' => 'dispute_id']
];

$table = $map[$source]['table'];
$idColumn = $map[$source]['id'];
$requestEmployeeReference = getEmployeeReferenceTable($conn, $table);

$hasApprovedBy = false;
$columnsRes = $conn->query("SHOW COLUMNS FROM $table LIKE 'approved_by'");
if ($columnsRes && $columnsRes->num_rows > 0) {
    $hasApprovedBy = true;
}

$checkStmt = $conn->prepare("SELECT status, employee_id FROM $table WHERE $idColumn = ? LIMIT 1");
$checkStmt->bind_param('i', $requestId);
$checkStmt->execute();
$existing = $checkStmt->get_result()->fetch_assoc();

if (!$existing) {
    http_response_code(404);
    echo json_encode(["error" => "Request not found."]);
    exit;
}

$currentStatus = strtolower((string)($existing['status'] ?? ''));
if ($currentStatus !== 'endorsed') {
    http_response_code(409);
    echo json_encode(["error" => "Only endorsed requests can be finalized by admin."]);
    exit;
}

$requesterEmployeeId = (int)($existing['employee_id'] ?? 0);
$requesterRole = '';
if ($source === 'dispute') {
    $requesterRole = getUserRoleByReference($conn, $requesterEmployeeId, $requestEmployeeReference === 'users');
    if (!in_array($requesterRole, ['coach', 'admin', 'super admin'], true)) {
        http_response_code(403);
        echo json_encode(["error" => "Attendance disputes can only be finalized for coach, admin, or super admin requesters."]);
        exit;
    }
}

$currentEmployeeId = $adminId;
$employeeStmt = $conn->prepare("SELECT employee_id FROM employees WHERE user_id = ? LIMIT 1");
if ($employeeStmt) {
    $employeeStmt->bind_param('i', $adminId);
    $employeeStmt->execute();
    $employeeResult = $employeeStmt->get_result();
    if ($employeeResult && $employeeResult->num_rows > 0) {
        $currentEmployeeId = (int)$employeeResult->fetch_assoc()['employee_id'];
    }
}

$isOwnRequest = false;
if ($requestEmployeeReference === 'users') {
    $isOwnRequest = $requesterEmployeeId === $adminId;
} else {
    $isOwnRequest = $requesterEmployeeId === $currentEmployeeId || $requesterEmployeeId === $adminId;
}

if ($isOwnRequest) {
    http_response_code(403);
    echo json_encode(["error" => "You cannot approve or reject your own request."]);
    exit;
}


if ($hasApprovedBy) {
    $updateStmt = $conn->prepare("UPDATE $table SET status = ?, approved_by = ? WHERE $idColumn = ?");
    $updateStmt->bind_param('sii', $status, $adminId, $requestId);
} else {
    $updateStmt = $conn->prepare("UPDATE $table SET status = ? WHERE $idColumn = ?");
    $updateStmt->bind_param('si', $status, $requestId);
}
$updateStmt->execute();

if ($conn->errno) {
    http_response_code(500);
    echo json_encode(["error" => "Unable to update request status."]);
    exit;
}

logCurrentUserAction(
    $conn,
    'request_finalize',
    buildAuditTarget($source, $requestId, 'status=' . $status)
);

echo json_encode(["success" => true]);