<?php

require_once "../cors.php";
session_start();

$roleName = strtolower(str_replace(' ', '', $_SESSION['role_name'] ?? ''));
if ($roleName !== 'superadmin') {
    http_response_code(403);
    exit();
}

require_once "../config/database.php";

// require_once "../utils/logger.php";

// logAction(
//     $conn,
//     $_SESSION['user_id'],
//     "Archived Employee",
//     $employee_id
// );

$result = $conn->query("
SELECT 
    employee_id,
    first_name,
    middle_name,
    last_name,
    position
FROM employees
WHERE archived = 1
");

$users = [];

while ($row = $result->fetch_assoc()) {

    $users[] = [
        "employee_id" => $row['employee_id'],
        "fullName" =>
            $row['first_name'] . " " .
            $row['middle_name'] . " " .
            $row['last_name'],
        "position" => $row['position']
    ];
}

echo json_encode([
    "success" => true,
    "users" => $users
]);