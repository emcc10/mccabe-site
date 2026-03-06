# Deploy and style changes (ready to commit)

This file documents the changes applied so you can commit them as a single update.

---

## 1. Deploy workflow (`.github/workflows/deploy.yml`)

- **Triggers:** Push to `main` and manual "Run workflow"
- **Protocol:** SFTP (port 2222) via Dylan700/sftp-upload-action
- **Secrets used:** `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`
- **Upload:** Local `vspfiles/` → remote `vspfiles/`

Set `FTP_SERVER` in GitHub Secrets to your SFTP hostname (e.g. `sftp.mccabestheaterandliving.com`) or IP. No port or `sftp://` in the secret.

---

## 2. Main menu same on all pages (`vspfiles/css/custom-safe.css`)

- Non-home desktop menu matches homepage hero menu: **gap 22px**, **padding 12px 20px**, centered with flex
- Removed `margin-left: -80px`; centering via `margin: 0 auto` and flex on the menu wrapper
- `.microblock.main-menu` (non-home, ≥992px): flex, centered, no extra padding

---

## 3. 992px breakpoint: mobile vs desktop menu

- **Below 992px:** "SELECT A CATEGORY" toggle is shown; desktop main menu is hidden; push menu panel can open
- **992px and up:** Toggle hidden; desktop main menu shown (non-home)

---

## 4. Menu shift fix (992px–1199px)

- On product/category pages, header is flex; menu column has `flex: 1 1 auto` and stays centered so the menu does not shift right when resizing through 1199px

---

## 5. Home and cart icons (same on all pages)

- **Same size and position:** `clamp(40px, 10vw, 52px)` for the button; `clamp(16px, 4vw, 20px)` for the icon
- **Safe margins:** `top: max(12px, env(safe-area-inset-top))`; left/right use `max(12px, env(safe-area-inset-left/right))` so icons don’t run off the screen
- **Proportional on mobile:** Same clamp values scale with viewport
- One unified block for both `.mc-home-float` and `.mc-cart-float` (and `a` variants)

---

## Files touched

| File | Change |
|------|--------|
| `.github/workflows/deploy.yml` | SFTP deploy on push and workflow_dispatch |
| `vspfiles/css/custom-safe.css` | Menu match, 992px breakpoint, menu shift fix, unified home/cart icons |

Commit these files and push to `main` to deploy and apply the styles.
