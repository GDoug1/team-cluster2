<?php
include __DIR__ . "/../../config/database.php";
include __DIR__ . "/../../config/auth.php";
requireRole("admin");

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

function getRequesterUserId(mysqli $conn, string $table, string $idColumn, int $requestId): ?int {
    if (!hasColumn($conn, $table, 'employee_id')) {
        return null;
    }

    $requestStmt = $conn->prepare("SELECT employee_id FROM $table WHERE $idColumn = ? LIMIT 1");
    $requestStmt->bind_param('i', $requestId);
    $requestStmt->execute();
    $requestRow = $requestStmt->get_result()->fetch_assoc();

    if (!$requestRow) {
        return null;
    }

    $employeeId = (int)($requestRow['employee_id'] ?? 0);
    if ($employeeId <= 0) {
        return null;
    }

    if (hasTable($conn, 'users') && hasColumn($conn, 'users', 'user_id')) {
        $directUserStmt = $conn->prepare("SELECT user_id FROM users WHERE user_id = ? LIMIT 1");
        $directUserStmt->bind_param('i', $employeeId);
        $directUserStmt->execute();
        $directUserRow = $directUserStmt->get_result()->fetch_assoc();
        if ($directUserRow) {
            return (int)$directUserRow['user_id'];
        }
    }

    if (hasTable($conn, 'users') && hasColumn($conn, 'users', 'id')) {
        $directUserStmt = $conn->prepare("SELECT id FROM users WHERE id = ? LIMIT 1");
        $directUserStmt->bind_param('i', $employeeId);
        $directUserStmt->execute();
        $directUserRow = $directUserStmt->get_result()->fetch_assoc();
        if ($directUserRow) {
            return (int)$directUserRow['id'];
        }
    }

    if (hasTable($conn, 'employees') && hasColumn($conn, 'employees', 'employee_id') && hasColumn($conn, 'employees', 'user_id')) {
        $employeeStmt = $conn->prepare("SELECT user_id FROM employees WHERE employee_id = ? LIMIT 1");
        $employeeStmt->bind_param('i', $employeeId);
        $employeeStmt->execute();
        $employeeRow = $employeeStmt->get_result()->fetch_assoc();
        if ($employeeRow) {
            return (int)$employeeRow['user_id'];
        }
    }

    return null;
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
$requesterUserId = getRequesterUserId($conn, $table, $idColumn, $requestId);

$hasApprovedBy = false;
$columnsRes = $conn->query("SHOW COLUMNS FROM $table LIKE 'approved_by'");
if ($columnsRes && $columnsRes->num_rows > 0) {
    $hasApprovedBy = true;
}

$checkStmt = $conn->prepare("SELECT status FROM $table WHERE $idColumn = ? LIMIT 1");
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

if ($requesterUserId !== null && $requesterUserId === $adminId) {
    http_response_code(409);
    echo json_encode(["error" => "Admin-filed requests must be finalized by a different admin."]);
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

echo json_encode(["success" => true]);
