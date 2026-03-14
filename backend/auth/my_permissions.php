<?php
include "../config/auth.php";
include "../config/database.php";

$userId = (int)($_SESSION['user']['id'] ?? 0);
if ($userId <= 0) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit;
}

$rolePermissionNames = [];
$roleStmt = $conn->prepare(
    "SELECT DISTINCT p.permission_name
     FROM users u
     INNER JOIN role_permissions rp ON rp.role_id = u.role_id
     INNER JOIN permissions p ON p.permission_id = rp.permission_id
     WHERE u.user_id = ?"
);

if ($roleStmt) {
    $roleStmt->bind_param("i", $userId);
    if ($roleStmt->execute()) {
        $result = $roleStmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $name = trim((string)($row['permission_name'] ?? ''));
            if ($name !== '') {
                $rolePermissionNames[$name] = true;
            }
        }
    }
}

$userOverrides = [];
$userStmt = $conn->prepare(
    "SELECT p.permission_name, up.is_allowed
     FROM user_permissions up
     INNER JOIN permissions p ON p.permission_id = up.permission_id
     WHERE up.user_id = ?"
);

if ($userStmt) {
    $userStmt->bind_param("i", $userId);
    if ($userStmt->execute()) {
        $result = $userStmt->get_result();
        while ($row = $result->fetch_assoc()) {
            $name = trim((string)($row['permission_name'] ?? ''));
            if ($name === '') continue;
            $isAllowed = (int)($row['is_allowed'] ?? 0) === 1;
            $userOverrides[$name] = $isAllowed;
        }
    }
}

foreach ($userOverrides as $name => $isAllowed) {
    if ($isAllowed) {
        $rolePermissionNames[$name] = true;
        continue;
    }

    unset($rolePermissionNames[$name]);
}

$permissions = array_keys($rolePermissionNames);
sort($permissions, SORT_NATURAL | SORT_FLAG_CASE);

echo json_encode([
    'success' => true,
    'permissions' => $permissions,
]);
