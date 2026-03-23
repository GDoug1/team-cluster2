<?php
include __DIR__ . "/../../config/database.php";
include __DIR__ . "/../../config/auth.php";
include __DIR__ . "/../utils/logger.php";

$userId = (int)($_SESSION['user']['id'] ?? 0);
if ($userId <= 0) {
    http_response_code(401);
    exit(json_encode(["error" => "Unauthorized"]));
}

function buildProfilePayload(array $row): array {
    return [
        "employee_id" => (int)($row["employee_id"] ?? 0),
        "user_id" => (int)($row["user_id"] ?? 0),
        "first_name" => trim((string)($row["first_name"] ?? "")),
        "middle_name" => trim((string)($row["middle_name"] ?? "")),
        "last_name" => trim((string)($row["last_name"] ?? "")),
        "address" => trim((string)($row["address"] ?? "")),
        "email" => trim((string)($row["email"] ?? "")),
        "personal_email" => trim((string)($row["personal_email"] ?? "")),
        "birthdate" => $row["birthdate"] ?? "",
        "civil_status" => trim((string)($row["civil_status"] ?? "")),
    ];
}

function fetchCurrentProfile(mysqli $conn, int $userId): ?array {
    $stmt = $conn->prepare(
        "SELECT
            e.employee_id,
            e.user_id,
            COALESCE(e.first_name, '') AS first_name,
            COALESCE(e.middle_name, '') AS middle_name,
            COALESCE(e.last_name, '') AS last_name,
            COALESCE(e.address, '') AS address,
            COALESCE(e.email, u.email, '') AS email,
            COALESCE(e.personal_email, '') AS personal_email,
            e.birthdate,
            COALESCE(e.civil_status, '') AS civil_status
         FROM employees e
         INNER JOIN users u ON u.user_id = e.user_id
         WHERE e.user_id = ? AND COALESCE(e.archived, 0) = 0
         LIMIT 1"
    );

    if (!$stmt) {
        return null;
    }

    $stmt->bind_param("i", $userId);
    if (!$stmt->execute()) {
        return null;
    }

    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    return $row ?: null;
}

function validateProfileInput(array $data): ?string {
    $firstName = trim((string)($data["first_name"] ?? ""));
    $middleName = trim((string)($data["middle_name"] ?? ""));
    $lastName = trim((string)($data["last_name"] ?? ""));
    $email = strtolower(trim((string)($data["email"] ?? "")));
    $personalEmail = strtolower(trim((string)($data["personal_email"] ?? "")));
    $birthdate = trim((string)($data["birthdate"] ?? ""));

    if ($firstName === "" || $lastName === "" || $email === "") {
        return "First name, last name, and email are required.";
    }

    foreach (["First name" => $firstName, "Middle name" => $middleName, "Last name" => $lastName] as $label => $value) {
        if ($value !== "" && preg_match('/\d/', $value) === 1) {
            return "{$label} cannot contain numbers.";
        }
    }

    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        return "Work email must be a valid email address.";
    }

    if ($personalEmail !== "" && filter_var($personalEmail, FILTER_VALIDATE_EMAIL) === false) {
        return "Personal email must be a valid email address.";
    }

    if ($birthdate !== "" && preg_match('/^\d{4}-\d{2}-\d{2}$/', $birthdate) !== 1) {
        return "Birthdate must use the YYYY-MM-DD format.";
    }

    $currentPassword = (string)($data["current_password"] ?? "");
    $newPassword = (string)($data["new_password"] ?? "");
    $confirmNewPassword = (string)($data["confirm_new_password"] ?? "");
    $isChangingPassword = $currentPassword !== "" || $newPassword !== "" || $confirmNewPassword !== "";

    if ($isChangingPassword) {
        if ($currentPassword === "" || $newPassword === "" || $confirmNewPassword === "") {
            return "Current password, new password, and confirm password are required to change your password.";
        }

        if (strlen($newPassword) < 8) {
            return "New password must be at least 8 characters long.";
        }

        if ($newPassword !== $confirmNewPassword) {
            return "New password and confirm password do not match.";
        }
    }

    return null;
}

$requestMethod = $_SERVER["REQUEST_METHOD"] ?? "GET";

if ($requestMethod === "GET") {
    $profile = fetchCurrentProfile($conn, $userId);
    if (!$profile) {
        http_response_code(404);
        exit(json_encode(["error" => "Profile not found."]));
    }

    echo json_encode(["profile" => buildProfilePayload($profile)]);
    exit;
}

if ($requestMethod !== "PUT") {
    http_response_code(405);
    exit(json_encode(["error" => "Method not allowed."]));
}

$payload = json_decode(file_get_contents("php://input"), true);
if (!$payload || !is_array($payload)) {
    http_response_code(400);
    exit(json_encode(["error" => "Invalid JSON payload."]));
}

$validationError = validateProfileInput($payload);
if ($validationError !== null) {
    http_response_code(400);
    exit(json_encode(["error" => $validationError]));
}

$profile = fetchCurrentProfile($conn, $userId);
if (!$profile) {
    http_response_code(404);
    exit(json_encode(["error" => "Profile not found."]));
}

$employeeId = (int)($profile["employee_id"] ?? 0);
$firstName = trim((string)($payload["first_name"] ?? ""));
$middleName = trim((string)($payload["middle_name"] ?? ""));
$lastName = trim((string)($payload["last_name"] ?? ""));
$address = trim((string)($payload["address"] ?? ""));
$email = strtolower(trim((string)($payload["email"] ?? "")));
$personalEmail = strtolower(trim((string)($payload["personal_email"] ?? "")));
$birthdate = trim((string)($payload["birthdate"] ?? ""));
$civilStatus = trim((string)($payload["civil_status"] ?? ""));
$currentPassword = (string)($payload["current_password"] ?? "");
$newPassword = (string)($payload["new_password"] ?? "");
$isChangingPassword = $currentPassword !== "" || $newPassword !== "" || (string)($payload["confirm_new_password"] ?? "") !== "";

$conn->begin_transaction();

try {
    $emailCheckStmt = $conn->prepare("SELECT user_id FROM users WHERE email = ? AND user_id <> ? LIMIT 1");
    if (!$emailCheckStmt) {
        throw new Exception("Unable to validate email.");
    }

    $emailCheckStmt->bind_param("si", $email, $userId);
    if (!$emailCheckStmt->execute()) {
        throw new Exception("Unable to validate email.");
    }

    $emailCheckResult = $emailCheckStmt->get_result();
    if ($emailCheckResult && $emailCheckResult->fetch_assoc()) {
        throw new Exception("Email already exists.");
    }

    $updateUserPasswordHash = null;
    if ($isChangingPassword) {
        $passwordCheckStmt = $conn->prepare("SELECT password FROM users WHERE user_id = ? LIMIT 1");
        if (!$passwordCheckStmt) {
            throw new Exception("Unable to verify current password.");
        }

        $passwordCheckStmt->bind_param("i", $userId);
        if (!$passwordCheckStmt->execute()) {
            throw new Exception("Unable to verify current password.");
        }

        $passwordResult = $passwordCheckStmt->get_result();
        $passwordRow = $passwordResult ? $passwordResult->fetch_assoc() : null;
        $storedHash = (string)($passwordRow["password"] ?? "");

        if ($storedHash === "" || !password_verify($currentPassword, $storedHash)) {
            throw new Exception("Current password is incorrect.");
        }

        $updateUserPasswordHash = password_hash($newPassword, PASSWORD_BCRYPT);
    }

    if ($updateUserPasswordHash !== null) {
        $updateUserStmt = $conn->prepare("UPDATE users SET email = ?, password = ? WHERE user_id = ?");
        if (!$updateUserStmt) {
            throw new Exception("Unable to update user account.");
        }

        $updateUserStmt->bind_param("ssi", $email, $updateUserPasswordHash, $userId);
        if (!$updateUserStmt->execute()) {
            throw new Exception("Unable to update user account.");
        }
    } else {
        $updateUserStmt = $conn->prepare("UPDATE users SET email = ? WHERE user_id = ?");
        if (!$updateUserStmt) {
            throw new Exception("Unable to update user email.");
        }

        $updateUserStmt->bind_param("si", $email, $userId);
        if (!$updateUserStmt->execute()) {
            throw new Exception("Unable to update user email.");
        }
    }

    $updateEmployeeStmt = $conn->prepare(
        "UPDATE employees
         SET first_name = ?,
             middle_name = ?,
             last_name = ?,
             address = ?,
             email = ?,
             personal_email = ?,
             birthdate = NULLIF(?, ''),
             civil_status = ?
         WHERE employee_id = ? AND user_id = ?"
    );

    if (!$updateEmployeeStmt) {
        throw new Exception("Unable to update profile.");
    }

    $updateEmployeeStmt->bind_param(
        "ssssssssii",
        $firstName,
        $middleName,
        $lastName,
        $address,
        $email,
        $personalEmail,
        $birthdate,
        $civilStatus,
        $employeeId,
        $userId
    );

    if (!$updateEmployeeStmt->execute()) {
        throw new Exception("Unable to update profile.");
    }

    $conn->commit();

    $_SESSION["user"]["fullname"] = trim($firstName . " " . $middleName . " " . $lastName);
    $_SESSION["user"]["email"] = $email;

    logCurrentUserAction($conn, "profile_update", buildAuditTarget("employee", $employeeId, $email));

    $updatedProfile = fetchCurrentProfile($conn, $userId);
    if (!$updatedProfile) {
        throw new Exception("Profile updated but could not be reloaded.");
    }

    echo json_encode(["profile" => buildProfilePayload($updatedProfile)]);
} catch (Throwable $error) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode(["error" => $error->getMessage()]);
}
