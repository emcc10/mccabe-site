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
retry_put "template_266.html" "/template_266.html" "template_266.html"
retry_put "template_266.html" "/v/template_266.html" "template_266-v"

retry_put "vspfiles/js/sectional-configs.js" "/vspfiles/js/sectional-configs.js" "sectional-configs.js"
retry_put "vspfiles/js/mtl-sectional-renderer.js" "/vspfiles/js/mtl-sectional-renderer.js" "mtl-sectional-renderer.js"

echo "Uploading custom-safe.css..."
retry_put "vspfiles/css/custom-safe.css" "/vspfiles/css/custom-safe.css" "custom-safe.css"

echo "Uploading mc-live-patch.css (new file — bypasses Cloudflare cache on custom-safe.css)..."
retry_put "vspfiles/css/mc-live-patch.css" "/vspfiles/css/mc-live-patch.css" "mc-live-patch.css"

echo "Uploading mccabe-overrides.css..."
retry_put "vspfiles/templates/266/css/mccabe-overrides.css" "/vspfiles/templates/266/css/mccabe-overrides.css" "mccabe-overrides.css"

echo "=== Post-deploy verify (origin via Cloudflare) ==="
verify_url() {
  local url="$1"
  local needle="$2"
  local line
  line=$(curl -fsSL "$url" -H "Cache-Control: no-cache" -H "Pragma: no-cache" 2>/dev/null | head -n 1 || true)
  echo "  $url"
  echo "  -> ${line:-[fetch failed]}"
  if [[ -n "$line" && "$line" == *"$needle"* ]]; then
    echo "  OK: found $needle"
  else
    echo "  WARN: expected $needle (Cloudflare may still serve old cache — purge CDN or wait)"
  fi
}

verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/css/mc-live-patch.css?v=20260518" "MC_LIVE_PATCH_DEPLOY_20260518"
verify_url "https://www.mccabestheaterandliving.com/-s/177.htm" "MC_LIVE_PATCH_20260518"
