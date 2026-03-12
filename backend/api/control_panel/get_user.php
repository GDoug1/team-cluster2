<?php

require_once "../cors.php";
session_start();

require_once "../utils/auth.php";
requireAuthenticated();

require_once "../config/database.php";

$currentUserId = getSessionUserId();
$stmt = $conn->prepare("
    SELECT first_name
    FROM employees
    WHERE user_id = ?
    LIMIT 1
");

$stmt->bind_param("i", $currentUserId);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows === 0) {
    http_response_code(404);
    echo json_encode([
        "success" => false,
        "message" => "Employee not found"
    ]);
    exit();
}

$employee = $result->fetch_assoc();

echo json_encode([
    "success" => true,
    "user" => [
        "first_name" => $employee['first_name'],
        "role_name"  => getSessionRole(),
        "permissions" => $_SESSION['permissions'] ?? []
    ]
]);

exit();
