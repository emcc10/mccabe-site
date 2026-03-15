<?php
/**
 * Room planner: save layout and email PDF to user.
 * POST body: JSON with email, layout, room, seatCount, options.
 * Implement: generate PDF from layout, send to $email, log for usage tracking.
 */
header('Content-Type: application/json');
$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!$data || empty($data['email'])) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Missing email']);
  exit;
}
$email = filter_var(trim($data['email']), FILTER_VALIDATE_EMAIL);
if (!$email) {
  http_response_code(400);
  echo json_encode(['ok' => false, 'error' => 'Invalid email']);
  exit;
}
// TODO: generate PDF from $data['layout'], $data['room']; send to $email; log for tracking
http_response_code(501);
echo json_encode(['ok' => false, 'message' => 'Email/PDF not implemented. Implement in planner-email.php.']);
