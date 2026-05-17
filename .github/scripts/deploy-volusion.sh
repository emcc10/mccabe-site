#!/usr/bin/env bash
# Deploy template, JS, and CSS to Volusion SFTP (port 2222).
# Web URLs use /v/vspfiles/… but SFTP home is usually chrooted at /v — upload to /vspfiles/… only.
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

# Returns: 0 = ok, 1 = failed after retries, 2 = skip (bad path — do not retry)
retry_put() {
  local local_path="$1"
  local remote_path="$2"
  local label="$3"
  local attempt out rc

  for attempt in $(seq 1 5); do
    echo "=== [$label] upload attempt ${attempt}/5 → ${remote_path} ==="

    set +e
    out=$(run_lftp "put ${local_path} -o ${remote_path}")
    rc=$?
    set -e
    echo "$out"

    if echo "$out" | grep -qiE 'cannot find the path|not find the path|No such file|does not exist'; then
      echo "[$label] SFTP path missing (not a lock) — skip: ${remote_path}"
      return 2
    fi

    if echo "$out" | grep -qiE 'Access failed|550 '; then
      echo "[$label] file locked (550); waiting before retry..."
    elif [[ "$rc" -ne 0 ]] || echo "$out" | grep -qiE 'put:.*[Ff]atal|Login failed'; then
      echo "[$label] upload error (exit ${rc}); waiting before retry..."
    else
      echo "=== [$label] uploaded successfully ==="
      return 0
    fi

    sleep $((attempt * 10))
  done

  echo "::error::[$label] still locked after 5 attempts — live site may be serving this file."
  return 1
}

# Try paths in order; succeed if any upload works. Skip missing paths immediately.
put_primary() {
  local local_path="$1"
  local label="$2"
  shift 2
  local remote ok=0 rc

  for remote in "$@"; do
    retry_put "$local_path" "$remote" "${label}@${remote}"
    rc=$?
    if [[ "$rc" -eq 0 ]]; then
      ok=1
      break
    fi
    if [[ "$rc" -eq 2 ]]; then
      continue
    fi
    echo "::error::[$label] failed for ${remote}"
    return 1
  done

  if [[ "$ok" -eq 0 ]]; then
    echo "::error::[$label] no SFTP path accepted upload"
    return 1
  fi
}

echo "=== Force template to all canonical SFTP paths (paramiko) ==="
export SFTP_HOST="${FTP_SERVER}"
export SFTP_USER="${FTP_USERNAME}"
export SFTP_PASS="${FTP_PASSWORD}"
export SFTP_PORT="2222"
python3 scripts/volusion_sftp_force_template.py

echo "=== Template backup upload (lftp) ==="
put_primary "template_266.html" "template" \
  "/v/template_266.html" \
  "/template_266.html" \
  "template_266.html"

echo "=== JS + CSS (SFTP paths under /vspfiles — served at https://host/v/vspfiles/…) ==="
put_primary "vspfiles/js/sectional-configs.js" "sectional-configs" \
  "/vspfiles/js/sectional-configs.js" \
  "vspfiles/js/sectional-configs.js"

put_primary "vspfiles/js/mc-site-fix.js" "mc-site-fix" \
  "/vspfiles/js/mc-site-fix.js" \
  "vspfiles/js/mc-site-fix.js"

put_primary "vspfiles/js/mtl-sectional-renderer.js" "mtl-sectional-renderer" \
  "/vspfiles/js/mtl-sectional-renderer.js" \
  "vspfiles/js/mtl-sectional-renderer.js"

put_primary "vspfiles/css/custom-safe.css" "custom-safe" \
  "/vspfiles/css/custom-safe.css" \
  "vspfiles/css/custom-safe.css"

put_primary "vspfiles/css/mc-live-patch.css" "mc-live-patch" \
  "/vspfiles/css/mc-live-patch.css" \
  "vspfiles/css/mc-live-patch.css"

put_primary "vspfiles/templates/266/css/mccabe-overrides.css" "mccabe-overrides" \
  "/vspfiles/templates/266/css/mccabe-overrides.css" \
  "vspfiles/templates/266/css/mccabe-overrides.css"

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
    echo "  WARN: expected $needle (purge Cloudflare cache for /v/vspfiles/* if needed)"
  fi
}

verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/css/custom-safe.css" "C_CSS_DEPLOY_VERIFY_20260518js"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/js/mtl-sectional-renderer.js" "MC_SITE_FIX_BUILD_20260518b"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/css/mc-live-patch.css?v=20260518" "MC_LIVE_PATCH_DEPLOY_20260518live"

echo ""
echo "Deploy finished. Hard-refresh the site (Ctrl+Shift+R)."
echo "PLP gray mats + hero hide ship in mtl-sectional-renderer.js (MC_SITE_FIX_BUILD_20260518b)."
