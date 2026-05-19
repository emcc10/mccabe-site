<?php
/**
 * Auth probe for My Boards page (does not require sign-in to call).
 */
header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

require_once __DIR__ . '/_auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method']);
    exit;
}

$cid = mc_boards_customer_id();
$signedIn = $cid !== '';

$payload = [
    'ok' => true,
    'signedIn' => $signedIn,
    'items' => [],
];

if ($signedIn) {
    $payload['items'] = mc_boards_read_items($cid);
}

echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
