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

$hasApprovedBy = false;
$columnsRes = $conn->query("SHOW COLUMNS FROM $table LIKE 'approved_by'");
if ($columnsRes && $columnsRes->num_rows > 0) {
    $hasApprovedBy = true;
}

$requestEmployeeExpr = 'req.employee_id';
$requesterRoleExpr = "''";
$employeeJoinSql = '';
$userJoinSql = '';

if (hasTable($conn, 'employees') && hasColumn($conn, 'employees', 'employee_id') && hasColumn($conn, 'employees', 'user_id')) {
    $employeeJoinSql = ' LEFT JOIN employees emp ON emp.employee_id = req.employee_id';
    $requestEmployeeExpr = 'COALESCE(emp.user_id, req.employee_id)';
}

if (hasTable($conn, 'users') && hasColumn($conn, 'users', 'id') && hasColumn($conn, 'users', 'role')) {
    $userJoinSql = " LEFT JOIN users requester ON requester.id = $requestEmployeeExpr";
    $requesterRoleExpr = 'COALESCE(requester.role, "")';
}

$checkStmt = $conn->prepare("SELECT req.status, $requestEmployeeExpr AS requester_user_id, $requesterRoleExpr AS requester_role FROM $table req $employeeJoinSql $userJoinSql WHERE req.$idColumn = ? LIMIT 1");
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

$requesterRole = strtolower((string)($existing['requester_role'] ?? ''));
$requesterUserId = (int)($existing['requester_user_id'] ?? 0);
if ($requesterRole === 'admin' && $requesterUserId > 0 && $requesterUserId === $adminId) {
    http_response_code(403);
    echo json_encode(["error" => "You cannot finalize your own admin request."]);
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
