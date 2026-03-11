<?php
include __DIR__ . "/../../config/database.php";
include __DIR__ . "/../../config/auth.php";
requireRole("admin");

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
