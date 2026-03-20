<?php
include __DIR__ . "/../../config/database.php";
include __DIR__ . "/../../config/auth.php";
include __DIR__ . "/../utils/logger.php";



function resolveEffectivePermissions(mysqli $conn, int $userId): array {
    $permissions = [];

    $roleStmt = $conn->prepare(
        "SELECT DISTINCT p.permission_name
         FROM users u
         INNER JOIN role_permissions rp ON rp.role_id = u.role_id
         INNER JOIN permissions p ON p.permission_id = rp.permission_id
         WHERE u.user_id = ?"
    );

    if ($roleStmt) {
        $roleStmt->bind_param("i", $userId);
        if ($roleStmt->execute()) {
            $result = $roleStmt->get_result();
            while ($row = $result->fetch_assoc()) {
                $name = trim((string)($row['permission_name'] ?? ''));
                if ($name !== '') {
                    $permissions[$name] = true;
                }
            }
        }
    }

    $overrideStmt = $conn->prepare(
        "SELECT p.permission_name, up.is_allowed
         FROM user_permissions up
         INNER JOIN permissions p ON p.permission_id = up.permission_id
         WHERE up.user_id = ?"
    );

    if ($overrideStmt) {
        $overrideStmt->bind_param("i", $userId);
        if ($overrideStmt->execute()) {
            $result = $overrideStmt->get_result();
            while ($row = $result->fetch_assoc()) {
                $name = trim((string)($row['permission_name'] ?? ''));
                if ($name === '') continue;
                $isAllowed = (int)($row['is_allowed'] ?? 0) === 1;

                if ($isAllowed) {
                    $permissions[$name] = true;
                } else {
                    unset($permissions[$name]);
                }
            }
        }
    }

    return array_keys($permissions);
}

function requireAnyPermission(mysqli $conn, array $permissionNames): void {
    $userId = (int)($_SESSION['user']['id'] ?? 0);
    if ($userId <= 0) {
        http_response_code(401);
        exit(json_encode(["error" => "Unauthorized"]));
    }

    $permissions = resolveEffectivePermissions($conn, $userId);
    foreach ($permissionNames as $permissionName) {
        if (in_array($permissionName, $permissions, true)) {
            return;
        }
    }

    http_response_code(403);
    exit(json_encode(["error" => "Forbidden"]));
}
function resolveEmployeeRoleId(mysqli $conn): ?int {
    $stmt = $conn->prepare("SELECT role_id FROM roles WHERE LOWER(role_name) LIKE '%employee%' LIMIT 1");
    if (!$stmt) return null;
    if (!$stmt->execute()) return null;

    $result = $stmt->get_result();
    $row = $result ? $result->fetch_assoc() : null;
    return isset($row['role_id']) ? (int)$row['role_id'] : null;
}

function validateEmployeeNameFields(string $firstName, string $middleName, string $lastName): ?string {
    $nameFields = [
        "First name" => $firstName,
        "Middle name" => $middleName,
        "Last name" => $lastName
    ];

    foreach ($nameFields as $label => $value) {
        if ($value !== '' && preg_match('/\d/', $value) === 1) {
            return "{$label} cannot contain numbers.";
        }
    }

    return null;
}

function validateEmployeeRequiredFields(
    string $firstName,
    string $lastName,
    string $address,
    string $birthdate,
    string $civilStatus,
    string $email,
    string $personalEmail,
    string $position,
    string $account,
    string $contactNumber,
    string $employeeType
): ?string {
    $requiredFields = [
        "First name" => $firstName,
        "Last name" => $lastName,
        "Address" => $address,
        "Birthdate" => $birthdate,
        "Contact number" => $contactNumber,
        "Civil status" => $civilStatus,
        "Personal email" => $personalEmail,
        "Work email" => $email,
        "Position" => $position,
        "Account" => $account,
        "Employee type" => $employeeType
    ];

    $missingFields = [];
    foreach ($requiredFields as $label => $value) {
        if (trim($value) === '') {
            $missingFields[] = $label;
        }
    }

    if (!empty($missingFields)) {
        return "Please complete all required employee fields: " . implode(", ", $missingFields) . ".";
    }

    if (preg_match('/^09\d{9}$/', $contactNumber) !== 1) {
        return "Contact number must start with 09 and be exactly 11 digits.";
    }

    if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        return "Work email must be a valid email address.";
    }

    if (filter_var($personalEmail, FILTER_VALIDATE_EMAIL) === false) {
        return "Personal email must be a valid email address.";
    }

    return null;
}

$requestMethod = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($requestMethod === 'GET') {
    requireAnyPermission($conn, ['View Employee List']);

    $showArchived = (string)($_GET['archived'] ?? '0') === '1';
    $archiveFilter = $showArchived
        ? "COALESCE(e.archived, 0) = 1"
        : "COALESCE(e.archived, 0) = 0";

    $sql = "SELECT
                e.employee_id,
                e.user_id,
                COALESCE(e.first_name, '') AS first_name,
                COALESCE(e.middle_name, '') AS middle_name,
                COALESCE(e.last_name, '') AS last_name,
                CONCAT_WS(' ', e.first_name, e.middle_name, e.last_name) AS fullname,
                COALESCE(e.address, '') AS address,
                e.birthdate,
                COALESCE(e.contact_number, '') AS contact_number,
                COALESCE(e.civil_status, '') AS civil_status,
                COALESCE(e.position, '') AS position,
                COALESCE(e.account, '') AS account,
                COALESCE(e.employee_type, '') AS employee_type,
                COALESCE(e.employment_status, '') AS employment_status,
                e.date_hired,
                COALESCE(e.email, u.email, '') AS email,
                COALESCE(e.personal_email, '') AS personal_email
            FROM employees e
            LEFT JOIN users u ON u.user_id = e.user_id
            WHERE {$archiveFilter}
            ORDER BY e.employee_id DESC";

    $result = $conn->query($sql);
    if (!$result) {
        http_response_code(500);
        exit(json_encode(["error" => "Unable to load employees."]));
    }

    $employees = [];
    while ($row = $result->fetch_assoc()) {
        $employees[] = [
            "id" => (int)$row['employee_id'],
            "user_id" => isset($row['user_id']) ? (int)$row['user_id'] : null,
            "first_name" => $row['first_name'],
            "middle_name" => $row['middle_name'],
            "last_name" => $row['last_name'],
            "fullname" => trim((string)$row['fullname']) ?: "Employee #{$row['employee_id']}",
            "address" => $row['address'],
            "birthdate" => $row['birthdate'],
            "contact_number" => $row['contact_number'],
            "civil_status" => $row['civil_status'],
            "position" => $row['position'],
            "account" => $row['account'],
            "employee_type" => $row['employee_type'],
            "employment_status" => $row['employment_status'],
            "date_hired" => $row['date_hired'],
            "email" => $row['email'],
            "personal_email" => $row['personal_email']
        ];
    }

    echo json_encode($employees);
    exit;
}

if ($requestMethod === 'PATCH') {
    requireAnyPermission($conn, ['Delete Employee']);

    $data = json_decode(file_get_contents("php://input"), true);
    $employeeId = (int)($data['employee_id'] ?? $data['id'] ?? 0);
    $action = trim((string)($data['action'] ?? ''));

    if ($employeeId <= 0 || $action === '') {
        http_response_code(400);
        exit(json_encode(["success" => false, "message" => "Employee id and action are required."]));
    }

    if ($action === 'restore') {
        $stmt = $conn->prepare(
            "UPDATE employees
             SET archived = 0,
                 employment_status = CASE WHEN employment_status = 'Archived' THEN 'Active' ELSE employment_status END
             WHERE employee_id = ? AND COALESCE(archived, 0) = 1"
        );

        if (!$stmt) {
            http_response_code(500);
            exit(json_encode(["success" => false, "message" => "Unable to restore employee."]));
        }

        $stmt->bind_param("i", $employeeId);
        if (!$stmt->execute()) {
            http_response_code(500);
            exit(json_encode(["success" => false, "message" => "Unable to restore employee."]));
        }

        if ($stmt->affected_rows <= 0) {
            http_response_code(404);
            exit(json_encode(["success" => false, "message" => "Archived employee not found."]));
        }

        logCurrentUserAction($conn, 'employee_restore', buildAuditTarget('employee', $employeeId));
        echo json_encode(["success" => true]);
        exit;
    }

    if ($action === 'permanent_delete') {
        $stmt = $conn->prepare("DELETE FROM employees WHERE employee_id = ? AND COALESCE(archived, 0) = 1");
        if (!$stmt) {
            http_response_code(500);
            exit(json_encode(["success" => false, "message" => "Unable to permanently delete employee."]));
        }

        $stmt->bind_param("i", $employeeId);
        if (!$stmt->execute()) {
            http_response_code(500);
            exit(json_encode(["success" => false, "message" => "Unable to permanently delete employee."]));
        }

        if ($stmt->affected_rows <= 0) {
            http_response_code(404);
            exit(json_encode(["success" => false, "message" => "Archived employee not found."]));
        }

        logCurrentUserAction($conn, 'employee_delete_permanent', buildAuditTarget('employee', $employeeId));
        echo json_encode(["success" => true]);
        exit;
    }

    http_response_code(400);
    exit(json_encode(["success" => false, "message" => "Invalid archive action."]));
}

if ($requestMethod === 'PUT') {
    requireAnyPermission($conn, ['Edit Employee']);

    $data = json_decode(file_get_contents("php://input"), true);
    if (!$data || !is_array($data)) {
        http_response_code(400);
        exit(json_encode(["success" => false, "message" => "Invalid JSON"]));
    }

    $employeeId = (int)($data['employee_id'] ?? $data['id'] ?? 0);
    if ($employeeId <= 0) {
        http_response_code(400);
        exit(json_encode(["success" => false, "message" => "Employee id is required."]));
    }

    $firstName = trim((string)($data['first_name'] ?? ''));
    $middleName = trim((string)($data['middle_name'] ?? ''));
    $lastName = trim((string)($data['last_name'] ?? ''));
    $address = trim((string)($data['address'] ?? ''));
    $birthdate = trim((string)($data['birthdate'] ?? ''));
    $civilStatus = trim((string)($data['civil_status'] ?? ''));
    $email = strtolower(trim((string)($data['email'] ?? $data['work_email'] ?? '')));
    $personalEmail = strtolower(trim((string)($data['personal_email'] ?? '')));
    $position = trim((string)($data['position'] ?? ''));
    $account = trim((string)($data['account'] ?? ''));
    $contactNumber = trim((string)($data['contact_number'] ?? ''));
    $employeeType = trim((string)($data['employee_type'] ?? ''));
    $employmentStatus = trim((string)($data['employment_status'] ?? 'Active'));
    $dateHired = trim((string)($data['date_hired'] ?? ''));

    if ($firstName === '' || $lastName === '' || $email === '') {
        http_response_code(400);
        exit(json_encode(["success" => false, "message" => "First name, last name, and email are required."]));
    }

    $nameValidationError = validateEmployeeNameFields($firstName, $middleName, $lastName);
    if ($nameValidationError !== null) {
        http_response_code(400);
        exit(json_encode(["success" => false, "message" => $nameValidationError]));
    }

    $requiredFieldsValidationError = validateEmployeeRequiredFields(
        $firstName,
        $lastName,
        $address,
        $birthdate,
        $civilStatus,
        $email,
        $personalEmail,
        $position,
        $account,
        $contactNumber,
        $employeeType
    );
    if ($requiredFieldsValidationError !== null) {
        http_response_code(400);
        exit(json_encode(["success" => false, "message" => $requiredFieldsValidationError]));
    }

    $conn->begin_transaction();
    try {
        $employeeStmt = $conn->prepare("SELECT employee_id, user_id FROM employees WHERE employee_id = ? AND COALESCE(archived, 0) = 0 LIMIT 1");
        if (!$employeeStmt) {
            throw new Exception("Unable to load employee record.");
        }

        $employeeStmt->bind_param("i", $employeeId);
        if (!$employeeStmt->execute()) {
            throw new Exception("Unable to load employee record.");
        }

        $employeeResult = $employeeStmt->get_result();
        $employeeRow = $employeeResult ? $employeeResult->fetch_assoc() : null;
        if (!$employeeRow) {
            throw new Exception("Employee not found.");
        }

        $linkedUserId = isset($employeeRow['user_id']) ? (int)$employeeRow['user_id'] : 0;

        $emailCheck = $conn->prepare("SELECT user_id FROM users WHERE email = ? LIMIT 1");
        if (!$emailCheck) {
            throw new Exception("Unable to validate email.");
        }

        $emailCheck->bind_param("s", $email);
        if (!$emailCheck->execute()) {
            throw new Exception("Unable to validate email.");
        }

        $emailResult = $emailCheck->get_result();
        $emailRow = $emailResult ? $emailResult->fetch_assoc() : null;
        if ($emailRow) {
            $existingUserId = (int)($emailRow['user_id'] ?? 0);
            if ($linkedUserId <= 0 || $existingUserId !== $linkedUserId) {
                throw new Exception("Email already exists.");
            }
        }

        if ($linkedUserId > 0) {
            $updateUserStmt = $conn->prepare("UPDATE users SET email = ? WHERE user_id = ?");
            if (!$updateUserStmt) {
                throw new Exception("Unable to update linked user account.");
            }

            $updateUserStmt->bind_param("si", $email, $linkedUserId);
            if (!$updateUserStmt->execute()) {
                throw new Exception("Unable to update linked user account.");
            }
        }

        $updateEmployeeStmt = $conn->prepare(
            "UPDATE employees
             SET first_name = ?,
                 middle_name = ?,
                 last_name = ?,
                 address = ?,
                 birthdate = NULLIF(?, ''),
                 civil_status = ?,
                 email = ?,
                 personal_email = ?,
                 position = ?,
                 account = ?,
                 contact_number = ?,
                 employment_status = ?,
                 employee_type = ?,
                 date_hired = NULLIF(?, '')
             WHERE employee_id = ?"
        );
        if (!$updateEmployeeStmt) {
            throw new Exception("Unable to update employee profile.");
        }

        $updateEmployeeStmt->bind_param(
            "ssssssssssssssi",
            $firstName,
            $middleName,
            $lastName,
            $address,
            $birthdate,
            $civilStatus,
            $email,
            $personalEmail,
            $position,
            $account,
            $contactNumber,
            $employmentStatus,
            $employeeType,
            $dateHired,
            $employeeId
        );

        if (!$updateEmployeeStmt->execute()) {
            throw new Exception("Unable to update employee profile.");
        }

        $conn->commit();
        logCurrentUserAction(
            $conn,
            'employee_update',
            buildAuditTarget('employee', $employeeId, $email)
        );
        echo json_encode(["success" => true]);
    } catch (Throwable $error) {
        $conn->rollback();
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => $error->getMessage()
        ]);
    }
    exit;
}

if ($requestMethod === 'DELETE') {
    requireAnyPermission($conn, ['Delete Employee']);

    $data = json_decode(file_get_contents("php://input"), true);
    $employeeId = (int)($data['employee_id'] ?? $data['id'] ?? $_GET['employee_id'] ?? 0);
    if ($employeeId <= 0) {
        http_response_code(400);
        exit(json_encode(["success" => false, "message" => "Employee id is required."]));
    }

    $stmt = $conn->prepare("UPDATE employees SET archived = 1, employment_status = 'Archived' WHERE employee_id = ? AND COALESCE(archived, 0) = 0");
    if (!$stmt) {
        http_response_code(500);
        exit(json_encode(["success" => false, "message" => "Unable to archive employee."]));
    }

    $stmt->bind_param("i", $employeeId);
    if (!$stmt->execute()) {
        http_response_code(500);
        exit(json_encode(["success" => false, "message" => "Unable to archive employee."]));
    }

    if ($stmt->affected_rows <= 0) {
        http_response_code(404);
        exit(json_encode(["success" => false, "message" => "Employee not found."]));
    }

    logCurrentUserAction($conn, 'employee_archive', buildAuditTarget('employee', $employeeId));
    echo json_encode(["success" => true]);
    exit;
}

if ($requestMethod !== 'POST') {
    http_response_code(405);
    exit(json_encode(["success" => false, "message" => "Method not allowed."]));
}

requireAnyPermission($conn, ['Add Employee']);

$data = json_decode(file_get_contents("php://input"), true);
if (!$data || !is_array($data)) {
    http_response_code(400);
    exit(json_encode(["success" => false, "message" => "Invalid JSON"]));
}

$firstName = trim((string)($data['first_name'] ?? ''));
$middleName = trim((string)($data['middle_name'] ?? ''));
$lastName = trim((string)($data['last_name'] ?? ''));
$address = trim((string)($data['address'] ?? ''));
$birthdate = trim((string)($data['birthdate'] ?? ''));
$civilStatus = trim((string)($data['civil_status'] ?? ''));
$email = strtolower(trim((string)($data['email'] ?? $data['work_email'] ?? '')));
$personalEmail = strtolower(trim((string)($data['personal_email'] ?? '')));
$position = trim((string)($data['position'] ?? ''));
$account = trim((string)($data['account'] ?? ''));
$contactNumber = trim((string)($data['contact_number'] ?? ''));
$employeeType = trim((string)($data['employee_type'] ?? ''));

if ($firstName === '' || $lastName === '' || $email === '') {
    http_response_code(400);
    exit(json_encode(["success" => false, "message" => "First name, last name, and email are required."]));
}

$nameValidationError = validateEmployeeNameFields($firstName, $middleName, $lastName);
if ($nameValidationError !== null) {
    http_response_code(400);
    exit(json_encode(["success" => false, "message" => $nameValidationError]));
}

$requiredFieldsValidationError = validateEmployeeRequiredFields(
    $firstName,
    $lastName,
    $address,
    $birthdate,
    $civilStatus,
    $email,
    $personalEmail,
    $position,
    $account,
    $contactNumber,
    $employeeType
);
if ($requiredFieldsValidationError !== null) {
    http_response_code(400);
    exit(json_encode(["success" => false, "message" => $requiredFieldsValidationError]));
}

$employeeRoleId = resolveEmployeeRoleId($conn);
if (!$employeeRoleId) {
    http_response_code(500);
    exit(json_encode(["success" => false, "message" => "Employee role is not configured."]));
}

$conn->begin_transaction();

try {
    $check = $conn->prepare("SELECT user_id FROM users WHERE email = ? LIMIT 1");
    if (!$check) {
        throw new Exception("Unable to validate email.");
    }

    $check->bind_param("s", $email);
    if (!$check->execute()) {
        throw new Exception("Unable to validate email.");
    }

    $result = $check->get_result();
    if ($result && $result->num_rows > 0) {
        throw new Exception("Email already exists.");
    }

    $firstLetter = strtolower(substr($firstName, 0, 1));
    $generatedPassword = $firstLetter . strtolower($lastName) . "@123!";
    $hashedPassword = password_hash($generatedPassword, PASSWORD_BCRYPT);

    $stmtUser = $conn->prepare(
        "INSERT INTO users (email, password, role_id, created_at)
         VALUES (?, ?, ?, NOW())"
    );
    if (!$stmtUser) {
        throw new Exception("Unable to prepare user statement.");
    }

    $stmtUser->bind_param("ssi", $email, $hashedPassword, $employeeRoleId);
    if (!$stmtUser->execute()) {
        throw new Exception("Unable to create user account.");
    }

    $userId = (int)$stmtUser->insert_id;

    $stmtEmp = $conn->prepare(
        "INSERT INTO employees (
            user_id,
            first_name,
            middle_name,
            last_name,
            address,
            birthdate,
            civil_status,
            email,
            personal_email,
            position,
            account,
            contact_number,
            employment_status,
            employee_type,
            date_hired
        )
        VALUES (
            ?, ?, ?, ?, ?, NULLIF(?, ''), ?, ?, ?, ?, ?, ?, 'Active', ?, CURDATE()
        )"
    );
    if (!$stmtEmp) {
        throw new Exception("Unable to prepare employee statement.");
    }

    $stmtEmp->bind_param(
        "issssssssssss",
        $userId,
        $firstName,
        $middleName,
        $lastName,
        $address,
        $birthdate,
        $civilStatus,
        $email,
        $personalEmail,
        $position,
        $account,
        $contactNumber,
        $employeeType
    );

    if (!$stmtEmp->execute()) {
        throw new Exception("Unable to create employee profile.");
    }

    $conn->commit();
    $employeeId = (int)$stmtEmp->insert_id;
    logCurrentUserAction(
        $conn,
        'employee_create',
        buildAuditTarget('employee', $employeeId, $email)
    );

    echo json_encode([
        "success" => true,
        "generated_account" => [
            "email" => $email,
            "password" => $generatedPassword
        ]
    ]);
} catch (Throwable $error) {
    $conn->rollback();
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => $error->getMessage()
    ]);
}
