# Deploy and style changes (ready to commit)

This file documents the changes applied so you can commit them as a single update.

---

## 1. Deploy workflow (`.github/workflows/deploy.yml`)

- **Triggers:** Push to `main` and manual "Run workflow"
- **Protocol:** SFTP (port 2222) via Dylan700/sftp-upload-action
- **Secrets used:** `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`
- **Uploads:**  
  - `template_266.html` (at repo root) → **v/template_266.html** on server (same as Volusion’s **v / template_266.html**). Edit only this file in the repo.  
  - `vspfiles/` → remote `v/vspfiles/` (path relative to your SFTP login folder)

Set `FTP_SERVER` in GitHub Secrets to your SFTP hostname or **IP** (hostname often fails from GitHub; IP is reliable). No port or `sftp://` in the secret.

**If the action succeeds but the live site doesn’t update:**

1. **Confirm the workflow ran:** GitHub → **Actions** → latest "Deploy Volusion Theme" run. If it failed (red), read the log (e.g. add missing secrets under Settings → Secrets and variables → Actions).
2. **Confirm where files land:** In FileZilla (or your SFTP client), connect and look at the top-level folders. Find where `custom-safe.css` actually lives (same path as the URL `/v/vspfiles/css/`). Check that file’s “Last modified” time after a deploy—if it’s not updated, the workflow is uploading to the wrong path.
3. **Try a different path:** In GitHub → Actions → “Deploy Volusion Theme” → “Run workflow”. You can enter a different **Remote path for vspfiles** (e.g. `vspfiles/` if your SFTP home is already the `v` folder, or `./v/vspfiles/`). Then run and check the site again.
4. **Volusion template:** In Volusion admin, confirm the store uses the theme that points to **v/template_266.html** and CSS **/v/vspfiles/css/custom-safe.css**.
5. **Cache:** Hard refresh (Ctrl+Shift+R) or private window. The template uses `?v=20260306` on the CSS so a hard refresh after deploy loads the new file.

**If `/v/vspfiles/css/custom-safe.css` does not show "DEPLOYED 2026-03-06" at the top:**  
The file the browser loads is not the one GitHub is uploading. In FileZilla, connect with the same host/user/port as in your secrets. After a deploy, find every `custom-safe.css` on the server. Check which folder has the file that was just updated (Modified = now). The web URL `/v/vspfiles/...` maps to some folder on the server—that folder might be your SFTP login folder, or a subfolder. If the updated file is in a different place (e.g. `vspfiles/css/` instead of `v/vspfiles/css/`), then when you "Run workflow" use **Remote path for vspfiles** = `vspfiles/` (so the workflow writes into the same path the site serves from).

**If no files show Modified after your deploy (e.g. everything still says 11:51 a.m.):**  
The workflow uploads relative to your **SFTP user's home directory**. When you open FileZilla, the folder you see first after login is that home. The workflow writes `v/template_266.html` and `v/vspfiles/...` **there**. So either (1) you're looking in a different folder (e.g. inside a "www" or "public_html" subfolder that the *web* server uses, while the workflow writes to the parent), or (2) the *web* server serves files from a different user/path than the one in your GitHub secrets. Run the workflow, then in FileZilla go to the **very first folder** you see after connecting (often just `/` or one top-level name). Look for a folder named `v` there—open it and check `vspfiles/css/custom-safe.css`. If that file's Modified time is *now*, the workflow is updating that location; the site may be serving from somewhere else (you’d need to align paths or ask Volusion where they serve `/v/` from). If you don't see a `v` folder there at all, try "Run workflow" with **Remote path for vspfiles** = `vspfiles/` and then look for a folder `vspfiles` at the top level.

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
