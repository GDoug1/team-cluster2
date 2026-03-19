<?php
include __DIR__ . "/common.php";

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    exit(json_encode(["error" => "Method not allowed"]));
}

requireControlPanelAccess($conn);

function getRoleNameMap(mysqli $conn): array {
    $map = [];
    $result = $conn->query("SELECT role_id, COALESCE(role_name, '') AS role_name FROM roles");
    if (!$result) {
        return $map;
    }

    while ($row = $result->fetch_assoc()) {
        $map[(int)$row['role_id']] = trim((string)$row['role_name']);
    }

    return $map;
}

function getPermissionNameMap(mysqli $conn): array {
    $map = [];
    $result = $conn->query("SELECT permission_id, COALESCE(permission_name, '') AS permission_name FROM permissions");
    if (!$result) {
        return $map;
    }

    while ($row = $result->fetch_assoc()) {
        $map[(int)$row['permission_id']] = trim((string)$row['permission_name']);
    }

    return $map;
}

function getUserDisplayMap(mysqli $conn): array {
    $map = [];
    $sql = "SELECT u.user_id,
                   COALESCE(u.email, '') AS email,
                   COALESCE(e.first_name, '') AS first_name,
                   COALESCE(e.middle_name, '') AS middle_name,
                   COALESCE(e.last_name, '') AS last_name
            FROM users u
            LEFT JOIN employees e ON e.user_id = u.user_id";
    $result = $conn->query($sql);
    if (!$result) {
        return $map;
    }

    while ($row = $result->fetch_assoc()) {
        $name = trim(implode(' ', array_filter([
            trim((string)($row['first_name'] ?? '')),
            trim((string)($row['middle_name'] ?? '')),
            trim((string)($row['last_name'] ?? '')),
        ])));

        if ($name === '') {
            $name = trim((string)($row['email'] ?? ''));
        }

        if ($name !== '') {
            $map[(int)$row['user_id']] = $name;
        }
    }

    return $map;
}

function getEmployeeDisplayMap(mysqli $conn): array {
    $map = [];
    $sql = "SELECT e.employee_id,
                   COALESCE(u.email, '') AS email,
                   COALESCE(e.first_name, '') AS first_name,
                   COALESCE(e.middle_name, '') AS middle_name,
                   COALESCE(e.last_name, '') AS last_name
            FROM employees e
            LEFT JOIN users u ON u.user_id = e.user_id";
    $result = $conn->query($sql);
    if (!$result) {
        return $map;
    }

    while ($row = $result->fetch_assoc()) {
        $name = trim(implode(' ', array_filter([
            trim((string)($row['first_name'] ?? '')),
            trim((string)($row['middle_name'] ?? '')),
            trim((string)($row['last_name'] ?? '')),
        ])));

        if ($name === '') {
            $name = trim((string)($row['email'] ?? ''));
        }

        if ($name !== '') {
            $map[(int)$row['employee_id']] = $name;
        }
    }

    return $map;
}

function formatLogActionLabel(string $action): string {
    $map = [
        'archive_user' => 'Archived User',
        'restore_user' => 'Restored User',
        'employee_create' => 'Created Employee',
        'employee_update' => 'Updated Employee',
        'role_permissions_update' => 'Updated Role Permissions',
        'user_permissions_update' => 'Updated User Permissions',
    ];

    $normalized = trim($action);
    if ($normalized === '') {
        return '';
    }

    return $map[$normalized] ?? ucwords(str_replace('_', ' ', $normalized));
}

function formatLogDateTime(?string $value): string {
    $raw = trim((string)$value);
    if ($raw === '') {
        return '';
    }

    try {
        $date = new DateTime($raw);
        return $date->format('F j, Y g:i:s A');
    } catch (Throwable $error) {
        return $raw;
    }
}

function formatPermissionsList(string $value, array $permissionNameMap): string {
    $names = [];
    foreach (explode(',', $value) as $permissionId) {
        $id = (int)trim($permissionId);
        if ($id <= 0) {
            continue;
        }

        $names[] = $permissionNameMap[$id] ?? "Permission #$id";
    }

    return count($names) > 0 ? implode(', ', $names) : 'None';
}

function formatAuditEntityLabel(string $entity, int $id, array $roleNameMap, array $userDisplayMap, array $employeeDisplayMap): string {
    if ($entity === 'role') {
        $name = trim((string)($roleNameMap[$id] ?? ''));
        return $name !== '' ? "Role: $name" : "Role #$id";
    }

    if ($entity === 'user') {
        $name = trim((string)($userDisplayMap[$id] ?? ''));
        return $name !== '' ? "User: $name" : "User #$id";
    }

    if ($entity === 'employee') {
        $name = trim((string)($employeeDisplayMap[$id] ?? ''));
        return $name !== '' ? "Employee: $name" : "Employee #$id";
    }

    $entityLabel = ucwords(str_replace('_', ' ', $entity));
    return $id > 0 ? "$entityLabel #$id" : $entityLabel;
}

function formatLogTarget(string $target, array $roleNameMap, array $permissionNameMap, array $userDisplayMap, array $employeeDisplayMap): string {
    $rawTarget = trim($target);
    if ($rawTarget === '') {
        return '';
    }

    $parts = preg_split('/\s+\|\s+/', $rawTarget, 2);
    $main = trim((string)($parts[0] ?? ''));
    $context = trim((string)($parts[1] ?? ''));

    $formattedParts = [];

    if (preg_match('/^([a-z_]+):(\d+)$/i', $main, $matches)) {
        $entity = strtolower(trim((string)$matches[1]));
        $id = (int)$matches[2];
        $formattedParts[] = formatAuditEntityLabel($entity, $id, $roleNameMap, $userDisplayMap, $employeeDisplayMap);
    } else {
        $formattedParts[] = $main;
    }

    if ($context !== '') {
        if (str_starts_with($context, 'permissions=')) {
            $permissionValue = substr($context, strlen('permissions='));
            $formattedParts[] = 'Permissions: ' . formatPermissionsList($permissionValue, $permissionNameMap);
        } elseif (str_contains($context, '=')) {
            [$key, $value] = array_pad(explode('=', $context, 2), 2, '');
            $label = ucwords(str_replace('_', ' ', trim($key)));
            $formattedParts[] = $label . ': ' . trim($value);
        } else {
            $formattedParts[] = 'Details: ' . $context;
        }
    }

    return implode(' | ', array_filter($formattedParts, static fn($part) => trim((string)$part) !== ''));
}

$roleNameMap = getRoleNameMap($conn);
$permissionNameMap = getPermissionNameMap($conn);
$userDisplayMap = getUserDisplayMap($conn);
$employeeDisplayMap = getEmployeeDisplayMap($conn);

$sql = "SELECT
            a.log_id,
            a.user_id,
            COALESCE(a.action, '') AS action,
            COALESCE(a.target, '') AS target,
            a.created_at,
            COALESCE(e.first_name, '') AS first_name,
            COALESCE(e.middle_name, '') AS middle_name,
            COALESCE(e.last_name, '') AS last_name,
            COALESCE(u.email, '') AS email
        FROM activity_logs a
        LEFT JOIN users u ON u.user_id = a.user_id
        LEFT JOIN employees e ON e.user_id = a.user_id
        ORDER BY a.created_at DESC, a.log_id DESC
        LIMIT 100";

$result = $conn->query($sql);
if (!$result) {
    http_response_code(500);
    exit(json_encode(["error" => "Unable to load logs."]));
}

$logs = [];
while ($row = $result->fetch_assoc()) {
    $name = trim(implode(' ', array_filter([
        trim((string)($row['first_name'] ?? '')),
        trim((string)($row['middle_name'] ?? '')),
        trim((string)($row['last_name'] ?? '')),
    ])));

    if ($name === '') {
        $name = trim((string)($row['email'] ?? ''));
    }

    if ($name === '') {
        $name = 'Unknown User';
    }

    $logs[] = [
        'id' => (int)$row['log_id'],
        'user_id' => (int)$row['user_id'],
        'user' => $name,
        'action' => formatLogActionLabel((string)$row['action']),
        'target' => formatLogTarget((string)$row['target'], $roleNameMap, $permissionNameMap, $userDisplayMap, $employeeDisplayMap),
        'created_at' => formatLogDateTime($row['created_at']),
        'raw_action' => (string)$row['action'],
        'raw_target' => (string)$row['target']
    ];
}

echo json_encode([
    'success' => true,
    'logs' => $logs
]);
