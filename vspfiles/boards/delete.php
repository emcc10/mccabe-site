<?php
/**
 * Deletes one item by id for the signed-in shopper.
 * POST JSON body: { "id": "..." }
 */
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method']);
    exit;
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$referer = $_SERVER['HTTP_REFERER'] ?? '';
$sfs = strtolower((string) ($_SERVER['HTTP_SEC_FETCH_SITE'] ?? ''));
$sameParty = strpos($origin, 'mccabestheaterandliving.com') !== false
    || preg_match('#^https?://([a-z0-9-]+\.)*mccabestheaterandliving\.com#i', $referer)
    || $sfs === 'same-origin' || $sfs === 'same-site';

if (!$sameParty) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'origin']);
    exit;
}

require_once __DIR__ . '/_auth.php';

$cid = mc_boards_customer_id();
if ($cid === '') {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'sign_in_required']);
    exit;
}

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
$id = isset($body['id']) ? trim((string) $body['id']) : '';
if ($id === '' || mb_strlen($id) > 80) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'bad_id']);
    exit;
}

$key = hash('sha256', $cid);
$file = __DIR__ . '/data/cust_' . $key . '.json';

if (!is_readable($file)) {
    echo json_encode(['ok' => true, 'removed' => 0]);
    exit;
}

$list = json_decode((string) file_get_contents($file), true);
if (!is_array($list)) {
    $list = [];
}

$before = count($list);
$list = array_values(array_filter($list, function ($row) use ($id) {
    return !isset($row['id']) || (string) $row['id'] !== $id;
}));
$removed = $before - count($list);

$tmp = $file . '.tmp';
file_put_contents($tmp, json_encode($list, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
rename($tmp, $file);

echo json_encode(['ok' => true, 'removed' => $removed]);
