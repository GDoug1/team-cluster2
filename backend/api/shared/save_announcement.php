<?php
include __DIR__ . "/../../config/database.php";
include __DIR__ . "/../../config/auth.php";
requireRole(["coach", "admin", "super admin"]);

$input = json_decode(file_get_contents("php://input"), true) ?? [];
$action = strtolower(trim((string)($input['action'] ?? '')));
$userId = (int)($_SESSION['user']['id'] ?? 0);

if ($action === 'create') {
    $title = trim((string)($input['title'] ?? ''));
    $content = trim((string)($input['content'] ?? ''));

    if ($title === '' || $content === '') {
        http_response_code(422);
        exit(json_encode(["error" => "Title and content are required."]));
    }

    $stmt = $conn->prepare("INSERT INTO announcements (title, content, posted_by, date_posted) VALUES (?, ?, ?, NOW())");
    if (!$stmt) {
        http_response_code(500);
        exit(json_encode(["error" => "Unable to prepare announcement creation."]));
    }

    $stmt->bind_param('ssi', $title, $content, $userId);
    if (!$stmt->execute()) {
        http_response_code(500);
        exit(json_encode(["error" => "Unable to create announcement."]));
    }

    $createdId = (int)$conn->insert_id;
    $result = $conn->query("SELECT announcement_id, title, content, posted_by, date_posted FROM announcements WHERE announcement_id = {$createdId} LIMIT 1");
    $created = $result ? $result->fetch_assoc() : null;

    echo json_encode([
        "announcement_id" => (int)($created['announcement_id'] ?? $createdId),
        "title" => (string)($created['title'] ?? $title),
        "content" => (string)($created['content'] ?? $content),
        "posted_by" => (int)($created['posted_by'] ?? $userId),
        "date_posted" => $created['date_posted'] ?? date('Y-m-d H:i:s')
    ]);
    exit;
}

if ($action === 'update') {
    $announcementId = (int)($input['announcement_id'] ?? 0);
    $title = trim((string)($input['title'] ?? ''));
    $content = trim((string)($input['content'] ?? ''));

    if ($announcementId <= 0 || $title === '' || $content === '') {
        http_response_code(422);
        exit(json_encode(["error" => "Announcement id, title and content are required."]));
    }

    $stmt = $conn->prepare("UPDATE announcements SET title = ?, content = ? WHERE announcement_id = ?");
    if (!$stmt) {
        http_response_code(500);
        exit(json_encode(["error" => "Unable to prepare announcement update."]));
    }

    $stmt->bind_param('ssi', $title, $content, $announcementId);
    if (!$stmt->execute()) {
        http_response_code(500);
        exit(json_encode(["error" => "Unable to update announcement."]));
    }

    $result = $conn->query("SELECT announcement_id, title, content, posted_by, date_posted FROM announcements WHERE announcement_id = {$announcementId} LIMIT 1");
    $updated = $result ? $result->fetch_assoc() : null;
    if (!$updated) {
        http_response_code(404);
        exit(json_encode(["error" => "Announcement not found."]));
    }

    echo json_encode([
        "announcement_id" => (int)$updated['announcement_id'],
        "title" => (string)$updated['title'],
        "content" => (string)$updated['content'],
        "posted_by" => (int)$updated['posted_by'],
        "date_posted" => $updated['date_posted']
    ]);
    exit;
}

if ($action === 'delete') {
    $announcementId = (int)($input['announcement_id'] ?? 0);
    if ($announcementId <= 0) {
        http_response_code(422);
        exit(json_encode(["error" => "Announcement id is required."]));
    }

    $stmt = $conn->prepare("DELETE FROM announcements WHERE announcement_id = ?");
    if (!$stmt) {
        http_response_code(500);
        exit(json_encode(["error" => "Unable to prepare announcement deletion."]));
    }

    $stmt->bind_param('i', $announcementId);
    if (!$stmt->execute()) {
        http_response_code(500);
        exit(json_encode(["error" => "Unable to delete announcement."]));
    }

    echo json_encode(["ok" => true]);
    exit;
}

http_response_code(400);
echo json_encode(["error" => "Unsupported action."]);
