<?php
include __DIR__ . "/../../config/database.php";
include __DIR__ . "/../../config/auth.php";

requireRole(["super admin", "admin"]);

function getAllPermissions(mysqli $conn): array {
    $result = $conn->query("SELECT permission_id, permission_name FROM permissions ORDER BY permission_id ASC");
    if (!$result) {
        return [];
    }

    $permissions = [];
    while ($row = $result->fetch_assoc()) {
        $permissions[] = [
            'id' => (int)$row['permission_id'],
            'name' => (string)$row['permission_name']
        ];
    }

    return $permissions;
}

function getRolePermissions(mysqli $conn): array {
    $sql = "SELECT r.role_id,
                   r.role_name,
                   COALESCE(r.role_description, '') AS role_description,
                   p.permission_id,
                   p.permission_name
            FROM roles r
            LEFT JOIN role_permissions rp ON rp.role_id = r.role_id
            LEFT JOIN permissions p ON p.permission_id = rp.permission_id
            ORDER BY r.role_id ASC, p.permission_id ASC";

    $result = $conn->query($sql);
    if (!$result) {
        return [];
    }

    $roleMap = [];
    while ($row = $result->fetch_assoc()) {
        $roleId = (int)$row['role_id'];
        if (!isset($roleMap[$roleId])) {
            $roleMap[$roleId] = [
                'id' => $roleId,
                'role' => (string)$row['role_name'],
                'description' => (string)$row['role_description'],
                'permissionIds' => [],
                'permissions' => []
            ];
        }

        if (!empty($row['permission_id'])) {
            $roleMap[$roleId]['permissionIds'][] = (int)$row['permission_id'];
            $roleMap[$roleId]['permissions'][] = (string)$row['permission_name'];
        }
    }

    return array_values($roleMap);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode([
        'success' => true,
        'permissionOptions' => getAllPermissions($conn),
        'rolePermissions' => getRolePermissions($conn)
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$payload = json_decode(file_get_contents('php://input'), true);
$roleId = (int)($payload['role_id'] ?? 0);
$permissionIds = $payload['permission_ids'] ?? null;

if ($roleId <= 0 || !is_array($permissionIds)) {
    http_response_code(400);
    echo json_encode(['error' => 'role_id and permission_ids are required']);
    exit;
}

$cleanPermissionIds = [];
foreach ($permissionIds as $permissionId) {
    $value = (int)$permissionId;
    if ($value > 0) {
        $cleanPermissionIds[$value] = true;
    }
}
$cleanPermissionIds = array_keys($cleanPermissionIds);

$conn->begin_transaction();

try {
    $deleteStmt = $conn->prepare("DELETE FROM role_permissions WHERE role_id = ?");
    if (!$deleteStmt) {
        throw new Exception('Failed to prepare delete statement');
    }

    $deleteStmt->bind_param("i", $roleId);
    if (!$deleteStmt->execute()) {
        throw new Exception('Failed to clear role permissions');
    }

    if (count($cleanPermissionIds) > 0) {
        $insertStmt = $conn->prepare("INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)");
        if (!$insertStmt) {
            throw new Exception('Failed to prepare insert statement');
        }

        foreach ($cleanPermissionIds as $permissionId) {
            $insertStmt->bind_param("ii", $roleId, $permissionId);
            if (!$insertStmt->execute()) {
                throw new Exception('Failed to save role permissions');
            }
        }
    }

    $conn->commit();

    echo json_encode([
        'success' => true,
        'rolePermissions' => getRolePermissions($conn)
    ]);
} catch (Throwable $error) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $error->getMessage()
    ]);
}
