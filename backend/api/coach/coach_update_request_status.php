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

function resolveRequesterRole(mysqli $conn, int $requesterId, ?string $requestEmployeeReference): string {
    if ($requesterId <= 0) {
        return '';
    }

    if ($requestEmployeeReference === 'users') {
        $stmt = $conn->prepare("SELECT LOWER(COALESCE(role, '')) AS role_name FROM users WHERE id = ? LIMIT 1");
        if ($stmt) {
            $stmt->bind_param('i', $requesterId);
            $stmt->execute();
            $result = $stmt->get_result();
            $row = $result ? $result->fetch_assoc() : null;
            return trim((string)($row['role_name'] ?? ''));
        }

        return '';
    }

    $stmt = $conn->prepare(
        "SELECT LOWER(COALESCE(u.role, '')) AS role_name
         FROM employees e
         INNER JOIN users u ON u.id = e.user_id
         WHERE e.employee_id = ?
         LIMIT 1"
    );
    if (!$stmt) {
        return '';
    }

    $stmt->bind_param('i', $requesterId);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    return trim((string)($row['role_name'] ?? ''));
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

if (!in_array($source, ['leave', 'overtime', 'dispute'], true) || $requestId <= 0 || !in_array($status, ['Approved', 'Endorsed'], true)) {
    http_response_code(422);
    echo json_encode(["error" => "Invalid request update payload."]);
    exit;
}

$map = [
    'leave' => ['table' => 'leave_requests', 'id' => 'leave_id'],
    'overtime' => ['table' => 'overtime_requests', 'id' => 'ot_id'],
    'dispute' => ['table' => 'attendance_disputes', 'id' => 'dispute_id']
];

$clusterColumns = getColumns($conn, 'clusters');
$employeeColumns = hasTable($conn, 'employees') ? getColumns($conn, 'employees') : [];
$requestEmployeeReference = getClusterMemberEmployeeReference($conn);
$clusterIdColumn = in_array('id', $clusterColumns, true) ? 'id' : 'cluster_id';
$clusterOwnerColumn = in_array('coach_id', $clusterColumns, true) ? 'coach_id' : 'user_id';
$coachId = (int)($_SESSION['user']['id'] ?? 0);
$table = $map[$source]['table'];
$idColumn = $map[$source]['id'];

$canJoinEmployees = in_array('user_id', $employeeColumns, true) && in_array('employee_id', $employeeColumns, true);
$requestEmployeeExpr = 'req.employee_id';
$employeeJoinSql = '';
if ($requestEmployeeReference === 'users' && $canJoinEmployees) {
    $requestEmployeeExpr = 'COALESCE(emp.employee_id, req.employee_id)';
    $employeeJoinSql = ' LEFT JOIN employees emp ON emp.user_id = req.employee_id';
}

$checkSql = "SELECT $requestEmployeeExpr AS employee_id
             FROM $table req
             $employeeJoinSql
             INNER JOIN cluster_members cm ON cm.employee_id = $requestEmployeeExpr
             INNER JOIN clusters c ON c.$clusterIdColumn = cm.cluster_id
             WHERE req.$idColumn = ? AND c.$clusterOwnerColumn = ? AND c.status = 'active'
             LIMIT 1";
$checkStmt = $conn->prepare($checkSql);
$checkStmt->bind_param('ii', $requestId, $coachId);
$checkStmt->execute();
$allowed = $checkStmt->get_result();
if (!$allowed || $allowed->num_rows === 0) {
    http_response_code(403);
    echo json_encode(["error" => "You can only update requests from your assigned team."]);
    exit;
}

$allowedRow = $allowed->fetch_assoc();
$requesterId = (int)($allowedRow['employee_id'] ?? 0);
$requesterRole = resolveRequesterRole($conn, $requesterId, $requestEmployeeReference);

$nextStatus = 'Endorsed';
if ($source === 'overtime' && strpos($requesterRole, 'coach') === false) {
    $nextStatus = 'Approved';
}

$updateStmt = $conn->prepare("UPDATE $table SET status = ? WHERE $idColumn = ?");
$updateStmt->bind_param('si', $nextStatus, $requestId);
$updateStmt->execute();

if ($conn->errno) {
    http_response_code(500);
    echo json_encode(["error" => "Unable to update request status."]);
    exit;
}

echo json_encode(["success" => true]);
