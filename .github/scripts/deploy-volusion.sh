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

echo "=== Assets via Paramiko (size-verified; /v/vspfiles + chroot paths) ==="
export SFTP_PORT="2222"
set +e
python3 scripts/deploy_volusion_assets.py
py_rc=$?
set -e
if [[ "$py_rc" -ne 0 ]]; then
  echo "::warning::Paramiko deploy exited $py_rc — continuing with lftp for remaining assets"
fi

echo "=== Assets via lftp (fallback + large JS) ==="
put_primary "vspfiles/templates/266/js/min/design-toolkit.min.js" "design-toolkit" \
  "/vspfiles/templates/266/js/min/design-toolkit.min.js" \
  "vspfiles/templates/266/js/min/design-toolkit.min.js"
put_primary "vspfiles/css/custom-safe.css" "custom-safe" \
  "/vspfiles/css/custom-safe.css" \
  "vspfiles/css/custom-safe.css"

put_primary "vspfiles/js/mc-plp-enforcer.js" "mc-plp-enforcer" \
  "/vspfiles/js/mc-plp-enforcer.js" \
  "vspfiles/js/mc-plp-enforcer.js"

put_primary "vspfiles/templates/266/js/mc-plp-enforcer.js" "mc-plp-enforcer-template" \
  "/vspfiles/templates/266/js/mc-plp-enforcer.js" \
  "vspfiles/templates/266/js/mc-plp-enforcer.js"

# template.min.js + mtl-sectional-renderer.js exceed Volusion 128 KiB SFTP cap — SKIP_CAP in Paramiko (not an error).
echo "=== skip template.min.js + mtl-sectional-renderer.js (>128 KiB; use Volusion File Manager or GitHub for renderer) ==="

put_primary "vspfiles/js/sectional-configs.js" "sectional-configs" \
  "/vspfiles/js/sectional-configs.js" \
  "vspfiles/js/sectional-configs.js"

put_primary "vspfiles/js/mc-site-fix.js" "mc-site-fix" \
  "/vspfiles/js/mc-site-fix.js" \
  "vspfiles/js/mc-site-fix.js"

put_primary "vspfiles/css/mc-live-patch.css" "mc-live-patch" \
  "/vspfiles/css/mc-live-patch.css" \
  "vspfiles/css/mc-live-patch.css"

put_primary "vspfiles/templates/266/css/mccabe-overrides.css" "mccabe-overrides" \
  "/vspfiles/templates/266/css/mccabe-overrides.css" \
  "vspfiles/templates/266/css/mccabe-overrides.css"

put_primary "vspfiles/css/mc-plp-body-last.css" "mc-plp-body-last" \
  "/vspfiles/css/mc-plp-body-last.css" \
  "vspfiles/css/mc-plp-body-last.css"

echo "=== PLP product photos (replace baked gray mat with white) ==="
photo_fail=0
photo_ok=0
shopt -s nullglob
for f in vspfiles/photos/*.jpg vspfiles/photos/*.jpeg vspfiles/photos/*.png; do
  base=$(basename "$f")
  if put_primary "$f" "plp-photo-${base}" \
    "/vspfiles/photos/${base}" \
    "/v/vspfiles/photos/${base}" \
    "vspfiles/photos/${base}"; then
    photo_ok=$((photo_ok + 1))
  else
    photo_fail=$((photo_fail + 1))
  fi
done
shopt -u nullglob
echo "PLP photos: ${photo_ok} uploaded, ${photo_fail} failed"
if [[ "$photo_fail" -gt 0 ]]; then
  echo "::error::PLP photo upload failed — gray mats will remain until photos are on server"
  exit 1
fi

if [[ "${SKIP_TEMPLATE_DEPLOY:-0}" != "1" ]]; then
  echo "=== Template (optional — set SKIP_TEMPLATE_DEPLOY=1 to skip) ==="
  export SFTP_HOST="${FTP_SERVER}"
  export SFTP_USER="${FTP_USERNAME}"
  export SFTP_PASS="${FTP_PASSWORD}"
  export SFTP_PORT="2222"
  python3 scripts/volusion_sftp_force_template.py
  put_primary "template_266.html" "template" "/v/template_266.html" "/template_266.html"
else
  echo "=== SKIP_TEMPLATE_DEPLOY=1 — template upload skipped ==="
fi

echo "=== Post-deploy verify ==="
verify_url() {
  local url="$1"
  local needle="$2"
  local body
  body=$(curl -fsSL "$url" -H "Cache-Control: no-cache" -H "Pragma: no-cache" 2>/dev/null | head -c 8000 || true)
  echo "  $url"
  if [[ -n "$body" && "$body" == *"$needle"* ]]; then
    echo "  OK: found $needle"
  else
    echo "  WARN: expected $needle"
  fi
}

verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/css/custom-safe.css?v=$(date +%s)" "C_CSS_DEPLOY_VERIFY_20260518e"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/js/mc-plp-enforcer.js?v=20260602" "MC_PLP_ENFORCER_20260602"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/templates/266/js/mc-plp-enforcer.js?v=20260602" "MC_PLP_ENFORCER_20260602"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/templates/266/js/min/design-toolkit.min.js" "MC_DTK_PLP_20260602"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/templates/266/js/min/template.min.js" "MC_PLP_ENFORCER_LOADING__"

echo ""
echo "=== Verify PLP photo on origin (77170-01-1.jpg must be 23747 bytes) ==="
want_photo=23747
got_photo=$(curl -fsSL "https://www.mccabestheaterandliving.com/v/vspfiles/photos/77170-01-1.jpg?v=$(date +%s)" -H "Cache-Control: no-cache" | wc -c | tr -d ' ')
echo "  live bytes: ${got_photo} (want ${want_photo})"
if [[ "$got_photo" != "$want_photo" ]]; then
  echo "::warning::PLP photo size mismatch — CDN may still cache old gray mat image"
fi

echo ""
echo "Deploy finished (~2–4 min). Hard-refresh category 177 (Ctrl+Shift+R)."
echo "SKIP_CAP on template.min / mtl-sectional-renderer is normal (128 KiB Volusion limit)."
echo "PLP fix: single enforcer v20260602 via design-toolkit.min.js + template body script."
echo "If still broken, Cloudflare Purge by URL:"
echo "  /v/vspfiles/js/sectional-configs.js?v=20260515-all-sectional-diagrams"
echo "  /v/vspfiles/templates/266/js/min/design-toolkit.min.js"
