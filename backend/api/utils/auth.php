<?php

function normalizeSessionRole(?string $role): string {
    $normalized = strtolower(trim((string)$role));

    if ($normalized === 'superadmin' || $normalized === 'super admin') {
        return 'super admin';
    }

    if ($normalized === 'administrator' || $normalized === 'admin') {
        return 'admin';
    }

    if (str_contains($normalized, 'coach')) {
        return 'coach';
    }

    return $normalized;
}

function getSessionUserId(): ?int {
    if (isset($_SESSION['user']['id'])) {
        return (int)$_SESSION['user']['id'];
    }

    if (isset($_SESSION['user_id'])) {
        return (int)$_SESSION['user_id'];
    }

    return null;
}

function getSessionRole(): string {
    $role = $_SESSION['user']['role'] ?? $_SESSION['role_name'] ?? '';
    return normalizeSessionRole($role);
}

function requireAuthenticated(): void {
    if (getSessionUserId() === null) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Not authenticated'
        ]);
        exit();
    }
}

function requireSuperAdmin(): void {
    requireAuthenticated();

    if (getSessionRole() !== 'super admin') {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Unauthorized'
        ]);
        exit();
    }
}
