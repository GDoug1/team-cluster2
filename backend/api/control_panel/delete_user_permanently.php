<?php

require_once "../cors.php";
header("Content-Type: application/json");

session_start();

$roleName = strtolower(str_replace(' ', '', $_SESSION['role_name'] ?? ''));
if ($roleName !== 'superadmin') {
    http_response_code(403);
    echo json_encode([
        "success" => false,
        "message" => "Unauthorized"
    ]);
    exit();
}

require_once "../config/database.php";
require_once "../utils/logger.php";

/* =========================
   GET EMPLOYEE ID
========================= */

if (!isset($_GET['employee_id'])) {
    echo json_encode([
        "success" => false,
        "message" => "Employee ID missing"
    ]);
    exit();
}

$employee_id = intval($_GET['employee_id']);

/* =========================
   DELETE EMPLOYEE
========================= */

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

/* =========================
   LOG ACTION
========================= */

logAction(
    $conn,
    $_SESSION['user_id'],
    "Deleted Employee Permanently",
    $employee_id
);

echo json_encode([
    "success" => true
]);