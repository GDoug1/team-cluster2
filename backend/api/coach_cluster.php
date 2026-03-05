<?php
include "../config/database.php";
include "../config/auth.php";
requireRole("coach");

header("Content-Type: application/json");

$columns = [];
$columnResult = $conn->query("SHOW COLUMNS FROM clusters");
if ($columnResult) {
    while ($row = $columnResult->fetch_assoc()) {
        $columns[] = $row["Field"];
    }
}

$idColumn = in_array("id", $columns, true) ? "id" : "cluster_id";
$ownerColumn = in_array("coach_id", $columns, true) ? "coach_id" : "user_id";
$coachId = (int)$_SESSION["user"]["id"];

$stmt = $conn->prepare(
    "SELECT c.$idColumn AS id,
            c.name,
            c.description,
            c.status,
            c.created_at,
            c.rejection_reason,
            COUNT(cm.employee_id) AS members
     FROM clusters c
     LEFT JOIN cluster_members cm ON cm.cluster_id = c.$idColumn
     WHERE c.$ownerColumn = ?
     GROUP BY c.$idColumn
     ORDER BY c.created_at DESC"
);

$stmt->bind_param("i", $coachId);
$stmt->execute();
$res = $stmt->get_result();

$clusters = [];
while ($row = $res->fetch_assoc()) {
    $row["id"] = (int)$row["id"];
    $row["members"] = (int)$row["members"];
    $clusters[] = $row;
}

echo json_encode($clusters);