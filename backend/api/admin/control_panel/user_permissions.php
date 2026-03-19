<?php
include __DIR__ . "/../../../config/database.php";
include __DIR__ . "/../../../config/auth.php";
include __DIR__ . "/../../utils/logger.php";

requireRoleOrPermission(["super admin", "admin"], $conn, "Access Control Panel");

function ensureUserPermissionsSchema(mysqli $conn): void {
    $indexes = [];
    $result = $conn->query("SHOW INDEX FROM user_permissions");
    if ($result) {
        while ($row = $result->fetch_assoc()) {
            $keyName = (string)($row['Key_name'] ?? '');
            $columnName = (string)($row['Column_name'] ?? '');
            if ($keyName === '') {
                continue;
            }

            if (!isset($indexes[$keyName])) {
                $indexes[$keyName] = [];
            }

            $indexes[$keyName][] = $columnName;
        }
    }

    $needsFix = isset($indexes['user_id']) || isset($indexes['permission_id']);
    $hasComposite = false;

    foreach ($indexes as $columns) {
        if (count($columns) === 2 && $columns[0] === 'user_id' && $columns[1] === 'permission_id') {
            $hasComposite = true;
            break;
        }
    }

    if (!$needsFix && $hasComposite) {
        return;
    }

    $conn->begin_transaction();

    try {
        if (isset($indexes['user_id'])) {
            if (!$conn->query("ALTER TABLE user_permissions DROP INDEX user_id")) {
                throw new Exception('Failed to drop invalid user_permissions.user_id index');
            }
        }

        if (isset($indexes['permission_id'])) {
            if (!$conn->query("ALTER TABLE user_permissions DROP INDEX permission_id")) {
                throw new Exception('Failed to drop invalid user_permissions.permission_id index');
            }
        }

        if (!$hasComposite) {
            if (!$conn->query("ALTER TABLE user_permissions ADD UNIQUE KEY uniq_user_permission (user_id, permission_id)")) {
                throw new Exception('Failed to create user_permissions composite unique index');
            }
        }

        $conn->commit();
    } catch (Throwable $error) {
        $conn->rollback();
        throw $error;
    }
}

ensureUserPermissionsSchema($conn);

function normalizeRoleName(string $roleName): string {
    return strtolower(trim($roleName));
}

function getRestrictedPermissionNamesForRole(string $roleName): array {
    $normalizedRole = normalizeRoleName($roleName);

    if ($normalizedRole === 'employee') {
        return [
            'Access Control Panel',
            'Add Employee',
            'Edit Employee',
            'Delete Employee',
            'Set Attendance',
            'Edit Attendance',
            'View Employee List'
        ];
    }

    if ($normalizedRole === 'team coach' || $normalizedRole === 'coach') {
        return [
            'Access Control Panel',
            'Add Employee',
            'Edit Employee',
            'Delete Employee'
        ];
    }

    return [];
}

function getPermissionIdNameMap(mysqli $conn): array {
    $result = $conn->query("SELECT permission_id, permission_name FROM permissions");
    if (!$result) {
        return [];
    }

    $permissionMap = [];
    while ($row = $result->fetch_assoc()) {
        $permissionMap[(int)$row['permission_id']] = (string)$row['permission_name'];
    }

    return $permissionMap;
}

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

function buildDisplayName(array $row): string {
    $name = trim(implode(' ', array_filter([
        trim((string)($row['first_name'] ?? '')),
        trim((string)($row['middle_name'] ?? '')),
        trim((string)($row['last_name'] ?? '')),
    ])));

    if ($name !== '') {
        return $name;
    }

    $email = trim((string)($row['email'] ?? ''));
    if ($email !== '') {
        return $email;
    }

    $userId = (int)($row['user_id'] ?? 0);
    return $userId > 0 ? "User #$userId" : 'Unknown User';
}

function getUserPermissions(mysqli $conn): array {
    $usersResult = $conn->query(
        "SELECT u.user_id,
                COALESCE(r.role_name, '') AS role_name,
                u.email,
                e.first_name,
                e.middle_name,
                e.last_name
         FROM users u
         LEFT JOIN roles r ON r.role_id = u.role_id
         LEFT JOIN employees e ON e.user_id = u.user_id
         ORDER BY u.user_id ASC"
    );

    if (!$usersResult) {
        return [];
    }

    $userMap = [];
    while ($row = $usersResult->fetch_assoc()) {
        $userId = (int)($row['user_id'] ?? 0);
        if ($userId <= 0) {
            continue;
        }

        $userMap[$userId] = [
            'userId' => $userId,
            'id' => 'USR-' . str_pad((string)$userId, 3, '0', STR_PAD_LEFT),
            'name' => buildDisplayName($row),
            'role' => trim((string)($row['role_name'] ?? '')),
            'email' => trim((string)($row['email'] ?? '')),
            'permissions' => []
        ];
    }

    if (count($userMap) === 0) {
        return [];
    }

    $rolePermissionsResult = $conn->query(
        "SELECT u.user_id,
                p.permission_name
         FROM users u
         INNER JOIN role_permissions rp ON rp.role_id = u.role_id
         INNER JOIN permissions p ON p.permission_id = rp.permission_id"
    );

    $effectivePermissionMap = [];
    if ($rolePermissionsResult) {
        while ($row = $rolePermissionsResult->fetch_assoc()) {
            $userId = (int)($row['user_id'] ?? 0);
            $permissionName = trim((string)($row['permission_name'] ?? ''));
            if ($userId <= 0 || $permissionName === '') {
                continue;
            }

            if (!isset($effectivePermissionMap[$userId])) {
                $effectivePermissionMap[$userId] = [];
            }

            $effectivePermissionMap[$userId][$permissionName] = true;
        }
    }

    $overridesResult = $conn->query(
        "SELECT up.user_id,
                p.permission_name,
                up.is_allowed
         FROM user_permissions up
         INNER JOIN permissions p ON p.permission_id = up.permission_id"
    );

    if ($overridesResult) {
        while ($row = $overridesResult->fetch_assoc()) {
            $userId = (int)($row['user_id'] ?? 0);
            $permissionName = trim((string)($row['permission_name'] ?? ''));
            $isAllowed = (int)($row['is_allowed'] ?? 0) === 1;
            if ($userId <= 0 || $permissionName === '') {
                continue;
            }

            if (!isset($effectivePermissionMap[$userId])) {
                $effectivePermissionMap[$userId] = [];
            }

            if ($isAllowed) {
                $effectivePermissionMap[$userId][$permissionName] = true;
            } else {
                unset($effectivePermissionMap[$userId][$permissionName]);
            }
        }
    }

    foreach ($userMap as $userId => $user) {
        $permissions = array_keys($effectivePermissionMap[$userId] ?? []);
        sort($permissions, SORT_NATURAL | SORT_FLAG_CASE);
        $userMap[$userId]['permissions'] = $permissions;
    }

    return array_values($userMap);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode([
        'success' => true,
        'permissionOptions' => getAllPermissions($conn),
        'rolePermissions' => getRolePermissions($conn),
        'userPermissions' => getUserPermissions($conn)
    ]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

function getUserRoleId(mysqli $conn, int $userId): int {
    $stmt = $conn->prepare("SELECT role_id FROM users WHERE user_id = ? LIMIT 1");
    if (!$stmt) {
        return 0;
    }

    $stmt->bind_param("i", $userId);
    if (!$stmt->execute()) {
        return 0;
    }

    $result = $stmt->get_result();
    if (!$result) {
        return 0;
    }

    $row = $result->fetch_assoc();
    return (int)($row['role_id'] ?? 0);
}

function getUserRoleName(mysqli $conn, int $userId): string {
    $stmt = $conn->prepare(
        "SELECT COALESCE(r.role_name, '') AS role_name
         FROM users u
         LEFT JOIN roles r ON r.role_id = u.role_id
         WHERE u.user_id = ?
         LIMIT 1"
    );
    if (!$stmt) {
        return '';
    }

    $stmt->bind_param("i", $userId);
    if (!$stmt->execute()) {
        return '';
    }

    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    return (string)($row['role_name'] ?? '');
}

function getRolePermissionIdMap(mysqli $conn, int $roleId): array {
    if ($roleId <= 0) {
        return [];
    }

    $stmt = $conn->prepare("SELECT permission_id FROM role_permissions WHERE role_id = ?");
    if (!$stmt) {
        return [];
    }

    $stmt->bind_param("i", $roleId);
    if (!$stmt->execute()) {
        return [];
    }

    $result = $stmt->get_result();
    if (!$result) {
        return [];
    }

    $permissionMap = [];
    while ($row = $result->fetch_assoc()) {
        $permissionId = (int)($row['permission_id'] ?? 0);
        if ($permissionId > 0) {
            $permissionMap[$permissionId] = true;
        }
    }

    return $permissionMap;
}

$payload = json_decode(file_get_contents('php://input'), true);
$userId = (int)($payload['user_id'] ?? 0);
$permissionIds = $payload['permission_ids'] ?? null;

if ($userId <= 0 || !is_array($permissionIds)) {
    http_response_code(400);
    echo json_encode(['error' => 'user_id and permission_ids are required']);
    exit;
}

$requestedPermissionMap = [];
foreach ($permissionIds as $permissionId) {
    $value = (int)$permissionId;
    if ($value > 0) {
        $requestedPermissionMap[$value] = true;
    }
}

$roleId = getUserRoleId($conn, $userId);
if ($roleId <= 0) {
    http_response_code(404);
    echo json_encode(['error' => 'User not found']);
    exit;
}

$targetUserRoleName = getUserRoleName($conn, $userId);
$restrictedPermissionNames = getRestrictedPermissionNamesForRole($targetUserRoleName);
if (count($restrictedPermissionNames) > 0) {
    $permissionIdNameMap = getPermissionIdNameMap($conn);
    $restrictedMap = array_fill_keys($restrictedPermissionNames, true);

    foreach (array_keys($requestedPermissionMap) as $permissionId) {
        $permissionName = $permissionIdNameMap[$permissionId] ?? '';
        if (isset($restrictedMap[$permissionName])) {
            unset($requestedPermissionMap[$permissionId]);
        }
    }
}

$rolePermissionMap = getRolePermissionIdMap($conn, $roleId);

$conn->begin_transaction();

try {
    $deleteStmt = $conn->prepare("DELETE FROM user_permissions WHERE user_id = ?");
    if (!$deleteStmt) {
        throw new Exception('Failed to prepare delete statement');
    }

    $deleteStmt->bind_param("i", $userId);
    if (!$deleteStmt->execute()) {
        throw new Exception('Failed to clear user permission overrides');
    }

    $insertStmt = $conn->prepare("INSERT INTO user_permissions (user_id, permission_id, is_allowed) VALUES (?, ?, ?)");
    if (!$insertStmt) {
        throw new Exception('Failed to prepare insert statement');
    }

    foreach ($requestedPermissionMap as $permissionId => $_) {
        if (!isset($rolePermissionMap[$permissionId])) {
            $isAllowed = 1;
            $insertStmt->bind_param("iii", $userId, $permissionId, $isAllowed);
            if (!$insertStmt->execute()) {
                throw new Exception('Failed to save user allow override');
            }
        }
    }

    foreach ($rolePermissionMap as $permissionId => $_) {
        if (!isset($requestedPermissionMap[$permissionId])) {
            $isAllowed = 0;
            $insertStmt->bind_param("iii", $userId, $permissionId, $isAllowed);
            if (!$insertStmt->execute()) {
                throw new Exception('Failed to save user deny override');
            }
        }
    }

    $conn->commit();
    logCurrentUserAction(
        $conn,
        'user_permissions_update',
        buildAuditTarget('user', $userId, 'permissions=' . implode(',', array_keys($requestedPermissionMap)))
    );

    echo json_encode([
        'success' => true,
        'rolePermissions' => getRolePermissions($conn),
        'userPermissions' => getUserPermissions($conn)
    ]);
} catch (Throwable $error) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $error->getMessage()
    ]);
}
