<?php
include __DIR__ . "/../../config/database.php";
include __DIR__ . "/../../config/auth.php";

requireRoleOrPermission(['employee', 'coach', 'admin', 'super admin'], $conn, 'View Team');

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
    $result = $conn->query(
        "SELECT
            a.announcement_id,
            COALESCE(a.title, '') AS title,
            COALESCE(a.content, '') AS content,
            DATE_FORMAT(a.date_posted, '%b %e, %Y %l:%i %p') AS date_posted,
            COALESCE(
                NULLIF(
                    TRIM(
                        CONCAT_WS(
                            ' ',
                            NULLIF(e.first_name, ''),
                            NULLIF(e.middle_name, ''),
                            NULLIF(e.last_name, '')
                        )
                    ),
                    ''
                ),
                u.email,
                ''
            ) AS posted_by_name
         FROM announcements a
         LEFT JOIN users u ON u.user_id = a.posted_by
         LEFT JOIN employees e ON e.user_id = u.user_id
         ORDER BY a.date_posted DESC, a.announcement_id DESC
         LIMIT 20"
    );

    if (!$result) {
        http_response_code(500);
        echo json_encode(['error' => 'Unable to load announcements']);
        exit;
    }

    $announcements = [];
    while ($row = $result->fetch_assoc()) {
        $announcements[] = $row;
    }

    echo json_encode(['announcements' => $announcements]);
    exit;
}

if ($method === 'POST') {
    requireRoleOrPermission(['coach', 'admin', 'super admin'], $conn, 'Edit Attendance');

    $payload = json_decode(file_get_contents("php://input"), true);
    $title = trim((string)($payload['title'] ?? ''));
    $content = trim((string)($payload['content'] ?? ''));
    $postedBy = (int)($_SESSION['user']['id'] ?? 0);

    if ($postedBy <= 0 || $title === '' || $content === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Title and content are required']);
        exit;
    }

    $stmt = $conn->prepare(
        "INSERT INTO announcements (title, content, posted_by, date_posted)
         VALUES (?, ?, ?, NOW())"
    );

    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['error' => 'Unable to create announcement']);
        exit;
    }

    $stmt->bind_param('ssi', $title, $content, $postedBy);
    if (!$stmt->execute()) {
        http_response_code(500);
        echo json_encode(['error' => 'Unable to create announcement']);
        exit;
    }

    http_response_code(201);
    echo json_encode([
        'announcement_id' => $conn->insert_id,
        'title' => $title,
        'content' => $content
    ]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
