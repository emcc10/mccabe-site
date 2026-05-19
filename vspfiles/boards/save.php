<?php
/**
 * Saves one inspiration item for the signed-in Volusion shopper (CustomerID cookie).
 * POST JSON body: { "item": { id, title, image, price, url, source, boardName, savedAt } }
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
if (!$body || empty($body['item']) || !is_array($body['item'])) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'bad_body']);
    exit;
}

$item = $body['item'];

function mc_boards_clamp($v, $max) {
    if (!is_string($v)) {
        return '';
    }
    return mb_substr(trim($v), 0, $max);
}

$id = isset($item['id']) ? mc_boards_clamp((string) $item['id'], 80) : '';
$title = isset($item['title']) ? mc_boards_clamp((string) $item['title'], 500) : '';
if ($id === '' || $title === '') {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'id_title']);
    exit;
}

$normalized = [
    'id' => $id,
    'title' => $title,
    'image' => isset($item['image']) ? mc_boards_clamp((string) $item['image'], 2000) : '',
    'price' => isset($item['price']) ? mc_boards_clamp((string) $item['price'], 120) : '',
    'url' => isset($item['url']) ? mc_boards_clamp((string) $item['url'], 2000) : '',
    'source' => isset($item['source']) ? mc_boards_clamp((string) $item['source'], 200) : '',
    'boardName' => isset($item['boardName']) ? mc_boards_clamp((string) $item['boardName'], 120) : 'Inspiration',
    'savedAt' => isset($item['savedAt']) ? mc_boards_clamp((string) $item['savedAt'], 40) : gmdate('c'),
];

$dataDir = __DIR__ . '/data';
if (!is_dir($dataDir)) {
    if (!@mkdir($dataDir, 0700, true)) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'mkdir']);
        exit;
    }
}

$key = hash('sha256', $cid);
$file = $dataDir . '/cust_' . $key . '.json';

$list = [];
if (is_readable($file)) {
    $list = json_decode((string) file_get_contents($file), true);
    if (!is_array($list)) {
        $list = [];
    }
}

$replaced = false;
foreach ($list as $i => $row) {
    if (isset($row['id']) && (string) $row['id'] === $normalized['id']) {
        $list[$i] = $normalized;
        $replaced = true;
        break;
    }
}
if (!$replaced) {
    array_unshift($list, $normalized);
}

if (count($list) > 500) {
    $list = array_slice($list, 0, 500);
}

$tmp = $file . '.tmp';
if (file_put_contents($tmp, json_encode($list, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'write']);
    exit;
}
if (!@rename($tmp, $file)) {
    @unlink($tmp);
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'rename']);
    exit;
}

echo json_encode(['ok' => true, 'stored' => 1]);
