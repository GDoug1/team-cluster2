<?php

require_once "../cors.php";

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

session_start();

require_once "../utils/auth.php";
requireSuperAdmin();

require_once "../config/database.php";

header('Content-Type: application/json');

$raw = file_get_contents("php://input");
$data = json_decode($raw, true);

if (!$data) {
    echo json_encode([
        "success" => false,
        "message" => "Invalid JSON received",
        "raw_input" => $raw
    ]);
    exit();
}

$user_id = intval($data['user_id']);
$permissions = $data['permissions'] ?? [];

foreach ($permissions as $perm) {

    $permission_id = intval($perm['permission_id']);
    $allowed = intval($perm['allowed']);

    $stmt = $conn->prepare("
        INSERT INTO user_permissions (user_id, permission_id, is_allowed)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE is_allowed = ?
    ");

    $stmt->bind_param("iiii", $user_id, $permission_id, $allowed, $allowed);
    $stmt->execute();
}

echo json_encode([
    "success" => true
]);
