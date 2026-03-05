<?php
header("Access-Control-Allow-Origin: http://localhost:5173");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: GET, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

include "../config/database.php";

$stmt = $conn->prepare(
    "SELECT role_id, role_name
     FROM roles
     ORDER BY role_id ASC"
);

if (!$stmt || !$stmt->execute()) {
    http_response_code(500);
    echo json_encode(["error" => "Unable to load roles"]);
    exit;
}

$result = $stmt->get_result();
$roles = [];

while ($row = $result->fetch_assoc()) {
    $roles[] = [
        "role_id" => (int)$row["role_id"],
        "role_name" => (string)$row["role_name"]
    ];
}

echo json_encode([
    "success" => true,
    "roles" => $roles
]);
