<?php
$conn = new mysqli("localhost", "root", "", "official_hris_db");
if ($conn->connect_error) {
    http_response_code(500);
    exit(json_encode(["error" => "DB connection failed"]));
}
