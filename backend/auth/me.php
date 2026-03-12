<?php
include "../config/auth.php";
include "../config/database.php";

$user = $_SESSION['user'] ?? null;

if (!$user) {
    http_response_code(401);
    echo json_encode(["error" => "Unauthorized"]);
    exit;
}

echo json_encode([
    "id" => $user["id"],
    "fullname" => $user["fullname"],
    "email" => $user["email"],
    "role" => $user["role"],
    "permissions" => (function () use ($conn, $user) {
        $permissions = [];

        $roleLookup = $conn->prepare("SELECT role_id FROM users WHERE user_id = ? LIMIT 1");
        if (!$roleLookup) {
            return $permissions;
        }

        $roleLookup->bind_param("i", $user["id"]);
        if (!$roleLookup->execute()) {
            return $permissions;
        }

        $roleResult = $roleLookup->get_result()->fetch_assoc();
        $roleId = (int)($roleResult["role_id"] ?? 0);

        if ($roleId <= 0) {
            return $permissions;
        }

        $permissionLookup = $conn->prepare(
            "SELECT p.permission_name,
                    CASE
                        WHEN up.is_allowed IS NULL THEN CASE WHEN rp.role_id IS NULL THEN 0 ELSE 1 END
                        ELSE up.is_allowed
                    END AS is_allowed
             FROM permissions p
             LEFT JOIN role_permissions rp ON rp.permission_id = p.permission_id AND rp.role_id = ?
             LEFT JOIN user_permissions up ON up.permission_id = p.permission_id AND up.user_id = ?
             ORDER BY p.permission_id"
        );

        if (!$permissionLookup) {
            return $permissions;
        }

        $permissionLookup->bind_param("ii", $roleId, $user["id"]);
        if (!$permissionLookup->execute()) {
            return $permissions;
        }

        $permissionResult = $permissionLookup->get_result();
        while ($row = $permissionResult->fetch_assoc()) {
            if ((int)($row["is_allowed"] ?? 0) === 1) {
                $permissions[] = $row["permission_name"];
            }
        }

        return $permissions;
    })()
]);
