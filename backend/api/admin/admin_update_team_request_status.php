<?php
include __DIR__ . "/../../config/database.php";
include __DIR__ . "/../../config/auth.php";
requireRole("admin");

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
$userColumns = hasTable($conn, 'users') ? getColumns($conn, 'users') : [];
$usersIdColumn = in_array('id', $userColumns, true) ? 'id' : (in_array('user_id', $userColumns, true) ? 'user_id' : null);

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

$isSelfRequestedAdminAction = false;
if ($usersIdColumn !== null && hasTable($conn, 'employees')) {
    $requesterStmt = $conn->prepare(
        "SELECT COALESCE(direct_user.$usersIdColumn, employee_user.$usersIdColumn) AS requester_user_id,
                LOWER(COALESCE(direct_user.role, employee_user.role, '')) AS requester_role
         FROM $table req
         LEFT JOIN users direct_user ON direct_user.$usersIdColumn = req.employee_id
         LEFT JOIN employees emp ON emp.employee_id = req.employee_id
         LEFT JOIN users employee_user ON employee_user.$usersIdColumn = emp.user_id
         WHERE req.$idColumn = ?
         LIMIT 1"
    );

    if ($requesterStmt) {
        $requesterStmt->bind_param('i', $requestId);
        $requesterStmt->execute();
        $requester = $requesterStmt->get_result()->fetch_assoc();
        $requesterUserId = (int)($requester['requester_user_id'] ?? 0);
        $requesterRole = strtolower((string)($requester['requester_role'] ?? ''));
        $isSelfRequestedAdminAction = $requesterUserId > 0 && $requesterUserId === $adminId && $requesterRole === 'admin';
    }
}

if ($isSelfRequestedAdminAction) {
    http_response_code(403);
    echo json_encode(["error" => "You cannot finalize your own filed request. Please ask another admin to review it."]);
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
