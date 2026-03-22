<?php

function currentAuditUserId(): int {
    return (int)($_SESSION['user']['id'] ?? 0);
}

function buildAuditTarget(string $entity, $id = null, ?string $context = null): string {
    $parts = [trim($entity)];

    if ($id !== null && $id !== '') {
        $parts[] = (string)$id;
    }

    $target = implode(':', $parts);
    $context = trim((string)$context);
    if ($context !== '') {
        $target .= ' | ' . $context;
    }

    return substr($target, 0, 255);
}

function logAction(mysqli $conn, $userId, string $action, ?string $target = null): bool {
    $safeUserId = (int)$userId;
    if ($safeUserId <= 0) {
        return false;
    }

    $safeAction = trim($action);
    if ($safeAction === '') {
        return false;
    }

    $safeTarget = $target !== null ? trim($target) : null;
    if ($safeTarget === '') {
        $safeTarget = null;
    }

    $stmt = $conn->prepare(
        "INSERT INTO activity_logs (user_id, action, target, created_at)
         VALUES (?, ?, ?, NOW())"
    );

    if (!$stmt) {
        return false;
    }

    $stmt->bind_param("iss", $safeUserId, $safeAction, $safeTarget);
    return $stmt->execute();
}

function logCurrentUserAction(mysqli $conn, string $action, ?string $target = null): bool {
    return logAction($conn, currentAuditUserId(), $action, $target);
}
