<?php
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($origin !== '') {
    header("Access-Control-Allow-Origin: {$origin}");
    header("Vary: Origin");
    header("Access-Control-Allow-Credentials: true");
    header("Access-Control-Allow-Headers: Content-Type");
    header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ✅ Start session ONLY if needed
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// ❌ REMOVE THIS (important)
// if (!isset($_SESSION['user'])) {
//     $_SESSION = [];
// }

header("Content-Type: application/json");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");
header("Expires: 0");

function normalizeRoleForCheck($roleName) {
    $role = strtolower(trim((string)$roleName));
    $compactRole = str_replace([' ', '-', '_'], '', $role);

    if ($compactRole === 'superadmin') {
        return 'super admin';
    }

    if ($compactRole === 'administrator') {
        return 'admin';
    }

    return $role;
}

function requireRole($role) {
    $currentRole = normalizeRoleForCheck($_SESSION['user']['role'] ?? '');

    if (is_array($role)) {
        $allowedRoles = array_map(fn($entry) => normalizeRoleForCheck($entry), $role);
        if (in_array($currentRole, $allowedRoles, true)) {
            return;
        }

        http_response_code(403);
        exit(json_encode(["error" => "Forbidden"]));
    }

    if ($currentRole !== normalizeRoleForCheck($role)) {
        http_response_code(403);
        exit(json_encode(["error" => "Forbidden"]));
    }
}

function currentUserHasAnyRole($role): bool {
    $currentRole = normalizeRoleForCheck($_SESSION['user']['role'] ?? '');

    if (is_array($role)) {
        $allowedRoles = array_map(fn($entry) => normalizeRoleForCheck($entry), $role);
        return in_array($currentRole, $allowedRoles, true);
    }

    return $currentRole === normalizeRoleForCheck($role);
}

function getCurrentUserPermissionMap(mysqli $conn): array {
    $userId = (int)($_SESSION['user']['id'] ?? 0);
    if ($userId <= 0) {
        return [];
    }

    $permissionMap = [];

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
                    $permissionMap[$name] = true;
                }
            }
        }
    }

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
                if ($isAllowed) {
                    $permissionMap[$name] = true;
                } else {
                    unset($permissionMap[$name]);
                }
            }
        }
    }

    return $permissionMap;
}

function currentUserHasPermission(mysqli $conn, string $permission): bool {
    $permissionName = trim($permission);
    if ($permissionName === '') {
        return false;
    }

    $permissionMap = getCurrentUserPermissionMap($conn);
    return isset($permissionMap[$permissionName]);
}

function requirePermission(mysqli $conn, $permission): void {
    $permissionsToCheck = is_array($permission) ? $permission : [$permission];
    foreach ($permissionsToCheck as $permissionName) {
        if (currentUserHasPermission($conn, (string)$permissionName)) {
            return;
        }
    }

    http_response_code(403);
    exit(json_encode(["error" => "Forbidden"]));
}

function requireRoleOrPermission($role, mysqli $conn, $permission): void {
    if (currentUserHasAnyRole($role)) {
        return;
    }

    $permissionsToCheck = is_array($permission) ? $permission : [$permission];
    foreach ($permissionsToCheck as $permissionName) {
        if (currentUserHasPermission($conn, (string)$permissionName)) {
            return;
        }
    }

    http_response_code(403);
    exit(json_encode(["error" => "Forbidden"]));
}
