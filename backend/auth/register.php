<?php
include "../cors.php";

include "../config/database.php";

function roleExists(mysqli $conn, int $roleId): bool {
    $stmt = $conn->prepare("SELECT role_id FROM roles WHERE role_id = ? LIMIT 1");
    if (!$stmt) {
        return false;
    }

    $stmt->bind_param("i", $roleId);
    if (!$stmt->execute()) {
        return false;
    }

    return (bool)$stmt->get_result()->fetch_assoc();
}

$data = json_decode(file_get_contents("php://input"), true);

$fullname = trim($data['fullname'] ?? '');
$email = strtolower(trim($data['email'] ?? ''));
$password = $data['password'] ?? '';
$roleId = isset($data['role_id']) ? (int)$data['role_id'] : 0;

if (!$fullname || !$email || !$password || $roleId <= 0) {
    http_response_code(400);
    echo json_encode(["error" => "All fields required"]);
    exit;
}

if (!roleExists($conn, $roleId)) {
    http_response_code(400);
    echo json_encode(["error" => "Invalid role"]);
    exit;
}

$check = $conn->prepare("SELECT user_id FROM users WHERE email = ?");
$check->bind_param("s", $email);
if (!$check->execute()) {
    http_response_code(500);
    echo json_encode(["error" => "Unable to validate email"]);
    exit;
}
$check->store_result();

if ($check->num_rows > 0) {
    http_response_code(409);
    echo json_encode(["error" => "Email already exists"]);
    exit;
}

$hashed = password_hash($password, PASSWORD_DEFAULT);

$stmt = $conn->prepare(
    "INSERT INTO users (email, password, role_id, created_at)
     VALUES (?, ?, ?, NOW())"
);
$stmt->bind_param("ssi", $email, $hashed, $roleId);
if (!$stmt->execute()) {
    http_response_code(500);
    echo json_encode(["error" => "Unable to create account"]);
    exit;
}

$userId = (int)$stmt->insert_id;

$nameParts = preg_split('/\s+/', $fullname) ?: [];
$firstName = array_shift($nameParts) ?? $fullname;
$lastName = implode(' ', $nameParts) ?: null;

$employeeStmt = $conn->prepare(
    "INSERT INTO employees (user_id, first_name, last_name, email)
     VALUES (?, ?, ?, ?)"
);
if ($employeeStmt) {
    $employeeStmt->bind_param("isss", $userId, $firstName, $lastName, $email);
    $employeeStmt->execute();
}

echo json_encode([
    "success" => true,
    "user_id" => $userId
]);