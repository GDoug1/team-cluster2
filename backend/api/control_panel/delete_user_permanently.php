<?php

require_once "../cors.php";
header("Content-Type: application/json");

session_start();

require_once "../utils/auth.php";
requireSuperAdmin();

require_once "../config/database.php";
require_once "../utils/logger.php";

if (!isset($_GET['employee_id'])) {
    echo json_encode([
        "success" => false,
        "message" => "Employee ID missing"
    ]);
    exit();
}

$employee_id = intval($_GET['employee_id']);

$stmt = $conn->prepare("
DELETE FROM employees
WHERE employee_id = ?
");

$stmt->bind_param("i", $employee_id);

if (!$stmt->execute()) {
    echo json_encode([
        "success" => false,
        "message" => "Delete failed"
    ]);
    exit();
}

logAction(
    $conn,
    getSessionUserId(),
    "Deleted Employee Permanently",
    "Employee ID: $employee_id"
);

echo json_encode([
    "success" => true
]);
