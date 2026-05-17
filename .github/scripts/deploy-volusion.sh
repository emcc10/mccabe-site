#!/usr/bin/env bash
# Deploy template, JS, and CSS to Volusion SFTP (port 2222).
set -euo pipefail

: "${FTP_SERVER:?FTP_SERVER is required}"
: "${FTP_USERNAME:?FTP_USERNAME is required}"
: "${FTP_PASSWORD:?FTP_PASSWORD is required}"

run_lftp() {
  local batch="$1"
  lftp -u "$FTP_USERNAME","$FTP_PASSWORD" "sftp://${FTP_SERVER}:2222" 2>&1 <<EOF
set sftp:auto-confirm yes
set net:max-retries 2
set net:timeout 120
set xfer:clobber yes
set xfer:use-temp-file yes
set sftp:connect-program "ssh -a -x -p 2222 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PreferredAuthentications=password -o PubkeyAuthentication=no"
${batch}
bye
EOF
}

# Volusion returns 550 while live files are served. Retry direct put only
# (do not use "mv -f" — server maps mv to mmv, which has no -f flag).
retry_put() {
  local local_path="$1"
  local remote_path="$2"
  local label="$3"
  local attempt out rc

  for attempt in $(seq 1 10); do
    echo "=== [$label] upload attempt ${attempt}/10 ==="

    set +e
    out=$(run_lftp "put ${local_path} -o ${remote_path}")
    rc=$?
    set -e
    echo "$out"

    if echo "$out" | grep -qiE 'Access failed|550 '; then
      echo "[$label] file locked (550); waiting before retry..."
    elif [[ "$rc" -ne 0 ]] || echo "$out" | grep -qiE 'put:.*[Ff]atal|Login failed'; then
      echo "[$label] upload error (exit ${rc}); waiting before retry..."
    else
      echo "=== [$label] uploaded successfully ==="
      return 0
    fi

    sleep $((attempt * 15))
  done

  echo "::error::[$label] still locked after 10 attempts — live site may be serving this file."
  return 1
}

echo "Uploading template to /template_266.html and /v/template_266.html..."
run_lftp "put template_266.html -o /template_266.html; put template_266.html -o /v/template_266.html"

retry_put "vspfiles/js/sectional-configs.js" "/vspfiles/js/sectional-configs.js" "sectional-configs.js"
retry_put "vspfiles/js/mtl-sectional-renderer.js" "/vspfiles/js/mtl-sectional-renderer.js" "mtl-sectional-renderer.js"

echo "Uploading custom-safe.css..."
retry_put "vspfiles/css/custom-safe.css" "/vspfiles/css/custom-safe.css" "custom-safe.css"
