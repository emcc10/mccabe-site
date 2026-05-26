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

deploy_template() {
  if [[ "${SKIP_TEMPLATE_DEPLOY:-0}" == "1" ]]; then
    echo "=== SKIP_TEMPLATE_DEPLOY=1 — template upload skipped ==="
    return 0
  fi
  if [[ ! -f template_266.html ]]; then
    echo "::error::Missing template_266.html in repo root"
    return 1
  fi
  echo "=== Template FIRST (before photos — ~$(wc -c < template_266.html) bytes) ==="
  export SFTP_HOST="${FTP_SERVER}"
  export SFTP_USER="${FTP_USERNAME}"
  export SFTP_PASS="${FTP_PASSWORD}"
  export SFTP_PORT="2222"
  # Brief pause after nc probe — Volusion sometimes drops the SSH banner on immediate reconnect.
  sleep 5
  set +e
  python3 scripts/volusion_sftp_force_template.py
  local py_rc=$?
  set -e
  if [[ "$py_rc" -eq 0 ]]; then
    return 0
  fi
  echo "::warning::Paramiko template upload failed (exit ${py_rc}) — trying lftp (same SSH as asset puts)"
  if put_primary "template_266.html" "template-lftp" \
    "/v/template_266.html" \
    "/template_266.html"; then
    echo "::notice::Template uploaded via lftp fallback"
    return 0
  fi
  echo "::error::Template upload failed after Paramiko retries and lftp fallback"
  return 1
}

verify_live_template_http() {
  local needle="$1"
  local url="https://www.mccabestheaterandliving.com/v/template_266.html?v=$(date +%s)"
  local body
  echo "=== Verify live template URL (informational — may lag SFTP) ==="
  echo "  $url"
  body=$(curl -fsSL "$url" -H "Cache-Control: no-cache" -H "Pragma: no-cache" 2>/dev/null || true)
  if [[ -n "$body" && "$body" == *"$needle"* ]]; then
    echo "  OK: HTTP template contains ${needle}"
    return 0
  fi
  echo "::warning::HTTP /v/template_266.html still missing ${needle} — normal if Volusion serves a cached/DB copy; SFTP verify above is authoritative."
  return 0
}

verify_template_on_sftp() {
  export TEMPLATE_NEEDLE="$1"
  python3 scripts/verify_template_sftp.py
}

TEMPLATE_ENFORCER_TAG=$(grep -oE 'mc-plp-enforcer\.js\?v=[0-9]+' template_266.html 2>/dev/null | head -1 || true)
if [[ -z "$TEMPLATE_ENFORCER_TAG" ]]; then
  TEMPLATE_ENFORCER_TAG="mc-plp-enforcer.js?v=20260625"
fi

python3 scripts/announce_deploy_markers.py || true

DEPLOY_STRICT="${DEPLOY_STRICT:-1}"
DEPLOY_FAIL=0

deploy_changed_only() {
  [[ "${DEPLOY_CHANGED_ONLY:-0}" == "1" || "${DEPLOY_CHANGED_ONLY:-}" == "true" ]]
}

deploy_file_changed() {
  local local_path="$1"
  if ! deploy_changed_only; then
    return 0
  fi
  [[ -n "${DEPLOY_CHANGED_FILES:-}" ]] && grep -Fxq "$local_path" <<<"${DEPLOY_CHANGED_FILES}"
}

deploy_prefix_changed() {
  local prefix="$1"
  if ! deploy_changed_only; then
    return 0
  fi
  [[ -n "${DEPLOY_CHANGED_FILES:-}" ]] && grep -Eq "^${prefix}" <<<"${DEPLOY_CHANGED_FILES}"
}

maybe_put_primary() {
  local local_path="$1"
  local label="$2"
  shift 2
  if ! deploy_file_changed "$local_path"; then
    echo "=== skip ${label}: ${local_path} unchanged ==="
    return 0
  fi
  put_primary "$local_path" "$label" "$@"
}

echo "=== DEPLOY_START ref=$(git rev-parse --short HEAD 2>/dev/null || echo unknown) ==="
echo "=== custom-safe line 1: $(head -1 vspfiles/css/custom-safe.css 2>/dev/null || echo MISSING) ==="

if deploy_changed_only && ! deploy_file_changed "template_266.html"; then
  export SKIP_TEMPLATE_DEPLOY="1"
fi

set +e
deploy_template
template_upload_rc=$?
set -e
if [[ "$template_upload_rc" -ne 0 ]]; then
  echo "::error::Template upload failed (exit ${template_upload_rc})"
  DEPLOY_FAIL=1
  if [[ "$DEPLOY_STRICT" == "1" ]]; then
    echo "::error::DEPLOY_STRICT=1 — aborting (template_266.html did not upload)"
    exit 1
  fi
fi

if [[ "${SKIP_TEMPLATE_DEPLOY:-0}" == "1" ]]; then
  echo "=== template unchanged; SFTP template verify skipped ==="
else
set +e
verify_template_on_sftp "$TEMPLATE_ENFORCER_TAG"
verify_rc=$?
set -e
if [[ "$verify_rc" -ne 0 ]]; then
  echo "::warning::SFTP template verify failed (exit ${verify_rc}) — continuing with vspfiles/CSS/JS upload"
  echo "::warning::If categories/PDPs look stale: Volusion Design → File Editor → template_266.html → Save"
  if [[ "$DEPLOY_STRICT" == "1" && "$template_upload_rc" -ne 0 ]]; then
    DEPLOY_FAIL=1
  fi
fi
fi

echo "=== Assets via Paramiko (size-verified; /v/vspfiles + chroot paths) ==="
export SFTP_PORT="2222"
set +e
python3 scripts/deploy_volusion_assets.py
py_rc=$?
set -e
if [[ "$py_rc" -ne 0 ]]; then
  echo "::warning::Paramiko deploy exited $py_rc — continuing with lftp for remaining assets"
  echo "::notice::Showcase PNG / mood SVG failures do not block template_266 or PDP login deploys"
  if [[ "$DEPLOY_STRICT" == "1" ]]; then
    DEPLOY_FAIL=1
  fi
fi

echo "=== Assets via lftp (fallback + large JS) ==="
maybe_put_primary "vspfiles/templates/266/js/min/design-toolkit.min.js" "design-toolkit" \
  "/vspfiles/templates/266/js/min/design-toolkit.min.js" \
  "vspfiles/templates/266/js/min/design-toolkit.min.js"
maybe_put_primary "vspfiles/css/custom-safe.css" "custom-safe" \
  "/v/vspfiles/css/custom-safe.css" \
  "/vspfiles/css/custom-safe.css" \
  "vspfiles/css/custom-safe.css"

CSS_VERIFY_NEEDLE=$(grep -oE 'C_CSS_DEPLOY_VERIFY_[0-9a-z]+' vspfiles/css/custom-safe.css 2>/dev/null | head -1 || echo "C_CSS_DEPLOY_VERIFY_20260522n")
export CSS_NEEDLE="$CSS_VERIFY_NEEDLE"
set +e
verify_custom_safe_sftp_rc=0
python3 scripts/verify_custom_safe_sftp.py
verify_custom_safe_sftp_rc=$?
set -e
if [[ "$verify_custom_safe_sftp_rc" -ne 0 ]]; then
  echo "::error::custom-safe.css SFTP verify failed (needle=${CSS_VERIFY_NEEDLE}) — CI failing so you are not misled by a green HTTP check"
  exit 1
fi

maybe_put_primary "vspfiles/js/mc-plp-enforcer.js" "mc-plp-enforcer" \
  "/vspfiles/js/mc-plp-enforcer.js" \
  "vspfiles/js/mc-plp-enforcer.js"

maybe_put_primary "vspfiles/js/mc-pdp-auth-cta-fix.js" "mc-pdp-auth-cta-fix" \
  "/v/vspfiles/js/mc-pdp-auth-cta-fix.js" \
  "/vspfiles/js/mc-pdp-auth-cta-fix.js" \
  "vspfiles/js/mc-pdp-auth-cta-fix.js"

maybe_put_primary "vspfiles/js/mc-pdp-auth-cta-boot.js" "mc-pdp-auth-cta-boot" \
  "/v/vspfiles/js/mc-pdp-auth-cta-boot.js" \
  "/vspfiles/js/mc-pdp-auth-cta-boot.js" \
  "vspfiles/js/mc-pdp-auth-cta-boot.js"

maybe_put_primary "vspfiles/js/mc-pdp-price-stack.js" "mc-pdp-price-stack" \
  "/v/vspfiles/js/mc-pdp-price-stack.js" \
  "/vspfiles/js/mc-pdp-price-stack.js" \
  "vspfiles/js/mc-pdp-price-stack.js"

maybe_put_primary "vspfiles/templates/266/js/mc-plp-enforcer.js" "mc-plp-enforcer-template" \
  "/vspfiles/templates/266/js/mc-plp-enforcer.js" \
  "vspfiles/templates/266/js/mc-plp-enforcer.js"

# template.min.js exceeds Volusion 128 KiB SFTP cap — SKIP_CAP in Paramiko (not an error).
echo "=== skip template.min.js (>128 KiB); mtl-sectional-renderer.js via Paramiko chunked upload ==="

maybe_put_primary "vspfiles/js/mtl-sectional-renderer.js" "mtl-sectional-renderer" \
  "/v/vspfiles/js/mtl-sectional-renderer.js" \
  "/vspfiles/js/mtl-sectional-renderer.js" \
  "vspfiles/js/mtl-sectional-renderer.js"

maybe_put_primary "vspfiles/js/mc-sectional-pdp-emergency.js" "mc-sectional-pdp-emergency" \
  "/v/vspfiles/js/mc-sectional-pdp-emergency.js" \
  "/vspfiles/js/mc-sectional-pdp-emergency.js" \
  "vspfiles/js/mc-sectional-pdp-emergency.js"

maybe_put_primary "vspfiles/js/sectional-configs.js" "sectional-configs" \
  "/vspfiles/js/sectional-configs.js" \
  "vspfiles/js/sectional-configs.js"

maybe_put_primary "vspfiles/js/mc-site-fix.js" "mc-site-fix" \
  "/vspfiles/js/mc-site-fix.js" \
  "vspfiles/js/mc-site-fix.js"

maybe_put_primary "vspfiles/css/mc-live-patch.css" "mc-live-patch" \
  "/vspfiles/css/mc-live-patch.css" \
  "vspfiles/css/mc-live-patch.css"

maybe_put_primary "vspfiles/templates/266/css/mccabe-overrides.css" "mccabe-overrides" \
  "/vspfiles/templates/266/css/mccabe-overrides.css" \
  "vspfiles/templates/266/css/mccabe-overrides.css"

maybe_put_primary "vspfiles/js/mc-plp-sofa-bounds.json" "mc-plp-sofa-bounds" \
  "/vspfiles/js/mc-plp-sofa-bounds.json" \
  "vspfiles/js/mc-plp-sofa-bounds.json"

maybe_put_primary "vspfiles/css/mc-plp-body-last.css" "mc-plp-body-last" \
  "/vspfiles/css/mc-plp-body-last.css" \
  "vspfiles/css/mc-plp-body-last.css"

if command -v node >/dev/null 2>&1 && [[ -f scripts/sanitize-boards-css.mjs ]]; then
  node scripts/sanitize-boards-css.mjs || true
fi

echo "=== My Boards (page, JS, CSS, PHP, showcase PNGs) ==="
run_lftp "mkdir -p /v/vspfiles/boards/showcase; mkdir -p /v/vspfiles/boards/mood; mkdir -p /vspfiles/boards/showcase; mkdir -p /vspfiles/boards/mood" || true
boards_fail=0
for f in \
  vspfiles/my-boards.html \
  vspfiles/boards/my-boards-page.js \
  vspfiles/boards/my-boards-app.js \
  vspfiles/boards/board-styles.js \
  vspfiles/boards/my-boards-page.css \
  vspfiles/boards/my-boards-critical.css \
  vspfiles/boards/my-boards-bundle.css \
  vspfiles/boards/my-boards-fragment.html \
  vspfiles/boards/session.php \
  vspfiles/boards/list.php \
  vspfiles/boards/save.php \
  vspfiles/boards/delete.php \
  vspfiles/boards/_auth.php; do
  if ! deploy_file_changed "$f"; then
    echo "=== skip boards: ${f} unchanged ==="
    continue
  fi
  base=$(basename "$f")
  rel="${f#vspfiles/}"
  if put_primary "$f" "boards-${base}" \
    "/v/vspfiles/${rel}" \
    "/vspfiles/${rel}"; then
    :
  else
    boards_fail=$((boards_fail + 1))
  fi
done
shopt -s nullglob
for f in vspfiles/boards/showcase/*.png; do
  if ! deploy_file_changed "$f"; then
    echo "=== skip boards-showcase: ${f} unchanged ==="
    continue
  fi
  base=$(basename "$f")
  if put_primary "$f" "boards-showcase-${base}" \
    "/v/vspfiles/boards/showcase/${base}" \
    "/vspfiles/boards/showcase/${base}"; then
    :
  else
    boards_fail=$((boards_fail + 1))
  fi
done
shopt -u nullglob
for f in vspfiles/boards/mood/*.svg; do
  if ! deploy_file_changed "$f"; then
    echo "=== skip boards-mood: ${f} unchanged ==="
    continue
  fi
  base=$(basename "$f")
  put_primary "$f" "boards-mood-${base}" \
    "/v/vspfiles/boards/mood/${base}" \
    "/vspfiles/boards/mood/${base}" || true
done
if [[ "$boards_fail" -gt 0 ]]; then
  echo "::warning::${boards_fail} My Boards showcase PNG(s) failed lftp upload (non-blocking; Paramiko chunked upload is primary)"
fi

echo "=== My Boards canonical /v/vspfiles force upload (fixes stale HTTP path) ==="
if deploy_prefix_changed "vspfiles/boards/" || deploy_file_changed "vspfiles/my-boards.html"; then
set +e
python3 scripts/upload_boards_canonical.py
boards_canon_rc=$?
set -e
if [[ "$boards_canon_rc" -ne 0 ]]; then
  echo "::error::upload_boards_canonical.py failed — my-boards-page.js may still be stale on live site"
fi

else
  echo "=== My Boards unchanged; canonical force upload skipped ==="
  boards_canon_rc=0
fi

echo "=== My Boards byte-size check (/v/vspfiles is what browsers load) ==="
if deploy_prefix_changed "vspfiles/boards/" || deploy_file_changed "vspfiles/my-boards.html"; then
for pair in \
  "vspfiles/boards/my-boards-page.js|/v/vspfiles/boards/my-boards-page.js" \
  "vspfiles/boards/board-styles.js|/v/vspfiles/boards/board-styles.js" \
  "vspfiles/boards/board-styles.js|/v/vspfiles/boards/board-styles.js" \
  "vspfiles/boards/my-boards-bundle.css|/v/vspfiles/boards/my-boards-bundle.css"; do
  local_file="${pair%%|*}"
  live_path="${pair##*|}"
  want=$(wc -c < "$local_file" | tr -d ' ')
  got=$(curl -fsSL "https://www.mccabestheaterandliving.com${live_path}?v=$(date +%s)" -H "Cache-Control: no-cache" 2>/dev/null | wc -c | tr -d ' ' || echo 0)
  if [[ "$got" == "$want" ]]; then
    echo "  OK ${live_path} bytes=${got}"
  else
    echo "::error::SIZE ${live_path} live=${got} want=${want} — boards JS/CSS not updated on origin"
    boards_canon_rc=1
  fi
done
else
  echo "=== My Boards unchanged; byte-size check skipped ==="
fi
if [[ "${boards_canon_rc:-0}" -ne 0 ]]; then
  echo "::warning::My Boards live byte check failed (non-blocking for template/CSS deploy)"
fi

echo "=== PLP product photos (replace baked gray mat with white) ==="
photo_fail=0
photo_ok=0
if [[ "${SKIP_PLP_PHOTOS:-0}" == "1" ]]; then
  echo "=== SKIP_PLP_PHOTOS=1 — skipping bulk PLP photo upload (use workflow_dispatch with photos enabled) ==="
else
shopt -s nullglob
for f in vspfiles/photos/*.jpg vspfiles/photos/*.jpeg vspfiles/photos/*.png; do
  if ! deploy_file_changed "$f"; then
    echo "=== skip plp-photo: ${f} unchanged ==="
    continue
  fi
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
  echo "::warning::PLP photo upload failed for ${photo_fail} file(s) — template already deployed; gray mats may persist on those SKUs"
fi
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

verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/css/custom-safe.css?v=$(date +%s)" "$CSS_VERIFY_NEEDLE"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/js/mc-plp-enforcer.js?v=20260625" "MC_PLP_ENFORCER_20260625"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/js/mc-plp-enforcer.js?v=20260625" "PDP_AUTH_WANT"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/js/sectional-configs.js?v=$(date +%s)" "MC_SECTIONAL_PDP_AUTH_INLINE_20260528"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/templates/266/js/mc-plp-enforcer.js?v=20260625" "MC_PLP_ENFORCER_20260625"

echo "=== mc-pdp JS gates (SFTP MD5 on /v/vspfiles = source of truth; HTTP curl confirms browser path) ==="
set +e
python3 scripts/verify_mc_pdp_js_sftp.py
verify_mc_pdp_sftp_rc=$?
python3 scripts/verify_mc_pdp_js_http.py
verify_mc_pdp_http_rc=$?
set -e
if [[ "$verify_mc_pdp_sftp_rc" -ne 0 ]]; then
  echo "::error::mc-pdp JS SFTP verify failed — files not on Volusion at /v/vspfiles/"
  DEPLOY_FAIL=1
  if [[ "$DEPLOY_STRICT" == "1" ]]; then
    exit 1
  fi
elif [[ "$verify_mc_pdp_http_rc" -ne 0 ]]; then
  echo "::warning::mc-pdp JS HTTP verify failed (GitHub IP may get 403) — SFTP canonical OK; spot-check in browser"
  echo "  fetch('/v/vspfiles/js/mc-pdp-auth-cta-fix.js?'+Date.now()).then(r=>r.text()).then(t=>console.log(t.includes('mcEnsurePdpPriceStack'), t.length))"
else
  echo "=== MC_PDP_JS_DEPLOY_VERIFIED (SFTP + HTTP) ==="
fi
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/js/mtl-sectional-renderer.js?v=$(date +%s)" "sectional-20260601-top-price-panel-v30"
python3 scripts/verify_mtl_renderer_live.py || true
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/templates/266/js/min/design-toolkit.min.js" "MC_DTK_PLP_20260625"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/templates/266/js/min/design-toolkit.min.js?v=20260625plp" "MC_DTK_PLP_20260625"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/js/mc-plp-sofa-bounds.json?v=$(date +%s)" "77494-91-1.jpg"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/my-boards.html?v=$(date +%s)" "20260542"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/boards/my-boards-bundle.css?v=20260542" "mc-boards__lifestyle-product-name"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/boards/board-styles.js?v=20260542" "The 2025 Interior Design Trends That Are Here to Stay"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/boards/my-boards-page.js?v=20260542" "Read article"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/my-boards.html?v=$(date +%s)" "mc-boards__triptych"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/boards/showcase/mid-century-lux-cognac-chair-angle.png?v=$(date +%s)" "PNG"
verify_url "https://www.mccabestheaterandliving.com/v/vspfiles/templates/266/js/min/template.min.js" "MC_PLP_ENFORCER_LOADING__"

echo ""
echo "=== Verify PLP photo on origin (77170-01-1.jpg — normalized asset byte size) ==="
want_photo=$(wc -c < vspfiles/photos/77170-01-1.jpg | tr -d ' ')
got_photo=$(curl -fsSL "https://www.mccabestheaterandliving.com/v/vspfiles/photos/77170-01-1.jpg?v=$(date +%s)" -H "Cache-Control: no-cache" | wc -c | tr -d ' ')
echo "  live bytes: ${got_photo} (want ${want_photo} from repo)"
if [[ "$got_photo" != "$want_photo" ]]; then
  echo "::warning::PLP photo size mismatch — CDN may still cache old gray-mat image; purge /v/vspfiles/photos/77170-01-1.jpg"
fi

echo ""
echo "Deploy finished (~2–4 min). Hard-refresh category 177 (Ctrl+Shift+R)."
echo "SKIP_CAP on template.min.js is normal (128 KiB Volusion limit); mtl-sectional-renderer uses chunked SFTP."
echo "PLP fix: single enforcer via design-toolkit.min.js + template body script (${TEMPLATE_ENFORCER_TAG})."
verify_live_template_http "$TEMPLATE_ENFORCER_TAG"
echo ""
echo "Category/product HTML is Volusion-BAKED: after SFTP template updates, open Volusion"
echo "Design → File Editor → template_266.html → Save once so /category-s/*.htm picks up changes."
echo "If still broken, Cloudflare Purge by URL:"
echo "  /v/vspfiles/js/sectional-configs.js?v=20260515-all-sectional-diagrams"
echo "  /v/vspfiles/templates/266/js/min/design-toolkit.min.js"
echo ""
echo "=== Live storefront verify (soft — does not fail CI) ==="
python3 scripts/verify_live_plp_deploy.py --soft || true

if [[ "$DEPLOY_FAIL" -ne 0 ]]; then
  echo "::error::Deploy finished with failures (template or prior step)"
  exit 1
fi
echo "=== DEPLOY_OK — template + custom-safe + mc-pdp JS (SFTP canonical; HTTP when runner not blocked) ==="
