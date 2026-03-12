<?php
require_once "../cors.php";
session_start();

if (!isset($_SESSION['user_id'], $_SESSION['employee_id'])) {
    http_response_code(401);
    echo json_encode([
        "success" => false,
        "message" => "Not authenticated"
    ]);
    exit();
}

require_once "../config/database.php";

$data = json_decode(file_get_contents("php://input"), true);

if (!$data || !isset($data['role_id'], $data['permissions'])) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid request data"
    ]);
    exit();
}

$role_id = $data['role_id'];
$permissions = $data['permissions'];

$roleStmt = $conn->prepare("SELECT role_name FROM roles WHERE role_id = ? LIMIT 1");
$roleStmt->bind_param("i", $role_id);
$roleStmt->execute();
$roleResult = $roleStmt->get_result()->fetch_assoc();
$roleName = strtolower(trim((string)($roleResult['role_name'] ?? '')));

if ($roleName === 'super admin') {
    http_response_code(403);
    echo json_encode([
        "success" => false,
        "message" => "Super Admin permissions are fixed and cannot be edited."
    ]);
    exit();
}

// Delete old permissions
$stmt = $conn->prepare("DELETE FROM role_permissions WHERE role_id = ?");
$stmt->bind_param("i", $role_id);
$stmt->execute();

// Insert new permissions
foreach ($permissions as $permission_name) {

    $stmt = $conn->prepare("SELECT permission_id FROM permissions WHERE permission_name = ?");
    $stmt->bind_param("s", $permission_name);
    $stmt->execute();
    $result = $stmt->get_result();
    $perm = $result->fetch_assoc();

    if ($perm) {
        $perm_id = $perm['permission_id'];

        $stmt2 = $conn->prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
        $stmt2->bind_param("ii", $role_id, $perm_id);
        $stmt2->execute();
    }
}

echo json_encode(["success" => true]);
?>
