<?php

if (!function_exists('logAction')) {
    function logAction(mysqli $conn, int $userId, string $action, string $target): void
    {
        $stmt = $conn->prepare('INSERT INTO activity_logs (user_id, action, target) VALUES (?, ?, ?)');
        if (!$stmt) {
            return;
        }

        $stmt->bind_param('iss', $userId, $action, $target);
        $stmt->execute();
        $stmt->close();
    }
}
