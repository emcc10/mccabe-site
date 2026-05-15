<?php
/**
 * Returns saved inspiration items for the signed-in shopper (CustomerID cookie).
 */
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method']);
    exit;
}

$cid = isset($_COOKIE['CustomerID']) ? trim((string) $_COOKIE['CustomerID']) : '';
if ($cid === '' || $cid === '0') {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'sign_in_required', 'items' => []]);
    exit;
}

$key = hash('sha256', $cid);
$file = __DIR__ . '/data/cust_' . $key . '.json';

$list = [];
if (is_readable($file)) {
    $list = json_decode((string) file_get_contents($file), true);
    if (!is_array($list)) {
        $list = [];
    }
}

echo json_encode(['ok' => true, 'items' => array_values($list)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
