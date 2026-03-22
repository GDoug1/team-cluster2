<?php
include "../config/auth.php";

// ✅ Only trust session user
if (!isset($_SESSION['user']) || !is_array($_SESSION['user'])) {
    http_response_code(401);
    echo json_encode(null);
    exit;
}

$user = $_SESSION['user'];

echo json_encode([
    "id" => $user["id"],
    "fullname" => $user["fullname"],
    "email" => $user["email"],
    "role" => $user["role"]
]);