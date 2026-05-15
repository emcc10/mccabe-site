const STORAGE_KEY = 'mccabe_board_v1';
const BOARD_NEW_VALUE = '__create_new_board__';

/** Production store — used for My Boards link + login detection. */
const MCCABES_STORE_ORIGIN = 'https://www.mccabestheaterandliving.com';
// Site page customers use (needs deploy to /v/vspfiles/).
const MCCABES_MY_BOARDS_PATH = '/v/vspfiles/my-boards.html';
const MCCABES_LOGIN_PATH = '/login.asp';
const MCCABES_BOARD_SAVE_URL = `${MCCABES_STORE_ORIGIN}/v/vspfiles/boards/save.php`;

function mccabesAbsoluteUrl(path) {
  return `${MCCABES_STORE_ORIGIN}${path}`;
}

const statusEl = document.getElementById('status');
const previewImage = document.getElementById('previewImage');
const fieldTitle = document.getElementById('fieldTitle');
const fieldImage = document.getElementById('fieldImage');
const fieldPrice = document.getElementById('fieldPrice');
const fieldSource = document.getElementById('fieldSource');
const fieldUrl = document.getElementById('fieldUrl');
const boardSelect = document.getElementById('boardSelect');
const newBoardRow = document.getElementById('newBoardRow');
const newBoardName = document.getElementById('newBoardName');
const btnSave = document.getElementById('btnSave');
const linkMyBoardsOnline = document.getElementById('linkMyBoardsOnline');
const signInForBoards = document.getElementById('signInForBoards');
const linkSignInOnline = document.getElementById('linkSignInOnline');
const linkLocalBoards = document.getElementById('linkLocalBoards');

/**
 * Guess whether the shopper is signed in at mccabes.com — no Volusion deploy needed.
 *
 * Strategy: cookie hints (often CustomerID) + /api/v1/users/current fetched from any
 * open McCabe's tab so the browser sends first-party cookies (extension fetch does not).
 */
function looksLikeSessionValue(value) {
  const v = String(value ?? '').trim();
  if (!v) return false;
  const lv = v.toLowerCase();
  if (lv === '0' || lv === 'false' || lv === 'null' || lv === 'undefined') return false;
  return true;
}

function inferLoginFromCookieList(cookieList) {
  for (const c of cookieList) {
    const n = (c.name || '').trim();
    const v = c.value ?? '';
    if (/^customerid$/i.test(n) && looksLikeSessionValue(v)) return true;
    if (/^custid$/i.test(n) && looksLikeSessionValue(v)) return true;
    if (/^sessioncustomer(?:id)?$/i.test(n) && looksLikeSessionValue(v)) return true;
  }
  return false;
}

async function tryLoginFromCookies() {
  if (!chrome.cookies?.getAll) return false;

  const indexUrls = [
    `${MCCABES_STORE_ORIGIN}/`,
    'https://mccabestheaterandliving.com/'
  ];

  for (const url of indexUrls) {
    try {
      const list = await chrome.cookies.getAll({ url });
      if (inferLoginFromCookieList(list)) return true;
    } catch (_) {
      //
    }
  }

  try {
    const dot = await chrome.cookies.getAll({ domain: '.mccabestheaterandliving.com' });
    if (inferLoginFromCookieList(dot)) return true;
  } catch (_) {
    //
  }

  try {
    const apex = await chrome.cookies.getAll({ domain: 'www.mccabestheaterandliving.com' });
    if (inferLoginFromCookieList(apex)) return true;
  } catch (_) {
    //
  }

  return false;
}

async function tryLoginFromVolusionTabProbe() {
  if (!chrome.scripting?.executeScript || !chrome.tabs?.query) return false;

  let tabs = [];
  try {
    tabs = await chrome.tabs.query({
      url: ['https://www.mccabestheaterandliving.com/*', 'https://mccabestheaterandliving.com/*']
    });
  } catch (_) {
    return false;
  }

  const prioritized = [...tabs.filter((t) => t.active), ...tabs.filter((t) => !t.active)];

  for (const tab of prioritized.slice(0, 14)) {
    if (tab.id == null || tab.discarded || tab.url == null) continue;
    try {
      const injected = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          try {
            const res = await fetch('/api/v1/users/current', {
              credentials: 'include'
            });
            if (res.status === 401 || res.status === 403) return false;
            if (!res.ok) return false;
            const ct = res.headers.get('content-type') || '';
            if (!ct.includes('json')) return false;
            const json = await res.json();
            const id = json?.data?.id ?? json?.data?.customerId ?? json?.id;
            const email = json?.data?.email;
            const numId = typeof id === 'number' ? id : Number(id);
            if (Number.isFinite(numId) && numId > 0) return true;
            if (typeof id === 'string' && id.trim() && id.trim() !== '0') return true;
            return Boolean(email && typeof email === 'string' && email.includes('@'));
          } catch (_) {
            return false;
          }
        }
      });
      if (injected?.[0]?.result === true) return true;
    } catch (_) {
      // Restricted tabs, unloaded pages, CSP edge cases — skip.
    }
  }

  return false;
}

async function isLoggedInToMccabesStore() {
  const fromCookies = await tryLoginFromCookies();
  if (fromCookies) return true;
  return tryLoginFromVolusionTabProbe();
}

async function refreshOnlineBoardsUi() {
  const loggedIn = await isLoggedInToMccabesStore();
  const boardsUrl = mccabesAbsoluteUrl(MCCABES_MY_BOARDS_PATH);
  const loginUrl = mccabesAbsoluteUrl(MCCABES_LOGIN_PATH);

  linkMyBoardsOnline.href = boardsUrl;
  linkSignInOnline.href = loginUrl;

  linkMyBoardsOnline.classList.toggle('hidden', !loggedIn);
  signInForBoards.classList.toggle('hidden', loggedIn);
}

/**
 * POST the saved item using a normal mccabes.com tab so session cookies attach (popup cannot send them cross-origin).
 * @returns {Promise<{ok: boolean, reason?: string, status?: number}>}
 */
async function syncToMccabesAccount(item) {
  if (!chrome.scripting?.executeScript || !chrome.tabs?.query) {
    return { ok: false, reason: 'missing_api' };
  }

  let tabs = [];
  try {
    tabs = await chrome.tabs.query({
      url: ['https://www.mccabestheaterandliving.com/*', 'https://mccabestheaterandliving.com/*']
    });
  } catch (_) {
    return { ok: false, reason: 'tab_query_failed' };
  }

  if (!tabs.length) {
    return { ok: false, reason: 'no_store_tab' };
  }

  const ordered = [...tabs.filter((t) => t.active), ...tabs.filter((t) => !t.active)];
  const endpoint = MCCABES_BOARD_SAVE_URL;

  for (const tab of ordered.slice(0, 8)) {
    if (tab.id == null || tab.discarded) continue;
    try {
      const injected = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async (payloadItem, url) => {
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ item: payloadItem })
            });
            const text = await res.text();
            let body = {};
            try {
              body = JSON.parse(text);
            } catch (_) {
              body = {};
            }
            return { status: res.status, body };
          } catch (e) {
            return { status: 0, body: {}, error: String(e) };
          }
        },
        args: [item, endpoint]
      });
      const r = injected?.[0]?.result;
      if (!r) continue;
      if (r.status === 200 && r.body && r.body.ok) {
        return { ok: true, status: 200 };
      }
      if (r.status === 401) {
        return { ok: false, reason: 'sign_in_required', status: 401 };
      }
      if (r.status >= 400) {
        return { ok: false, reason: 'server_error', status: r.status };
      }
    } catch (_) {
      //
    }
  }

  return { ok: false, reason: 'sync_failed' };
}

function setStatus(text, asError = false) {
  statusEl.textContent = text || '';
  statusEl.classList.toggle('error', Boolean(asError));
}

function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function loadState() {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  const state = raw[STORAGE_KEY];
  if (state && Array.isArray(state.items) && Array.isArray(state.boards)) return state;
  return { boards: ['Inspiration'], items: [] };
}

async function persistState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
}

function refreshPreviewFromFields() {
  const src = fieldImage.value.trim();
  if (src) {
    previewImage.src = src;
    previewImage.classList.add('visible');
    previewImage.alt = fieldTitle.value.trim() || 'Product preview';
  } else {
    previewImage.removeAttribute('src');
    previewImage.classList.remove('visible');
    previewImage.alt = '';
  }
}

function populateBoardSelect(boardNames) {
  boardSelect.innerHTML = '';
  const sorted = [...new Set(boardNames.map((b) => b.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
  for (const name of sorted) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    boardSelect.appendChild(opt);
  }
  const createOpt = document.createElement('option');
  createOpt.value = BOARD_NEW_VALUE;
  createOpt.textContent = 'Create New Board';
  boardSelect.appendChild(createOpt);

  if (sorted.length) {
    boardSelect.value = sorted[0];
  } else {
    boardSelect.value = BOARD_NEW_VALUE;
  }
  toggleNewBoardRow();
}

function toggleNewBoardRow() {
  const show = boardSelect.value === BOARD_NEW_VALUE;
  newBoardRow.classList.toggle('hidden', !show);
  if (show) {
    newBoardName.focus();
  }
}

function applyHints(hints) {
  fieldTitle.value = hints.title || '';
  fieldImage.value = hints.image || '';
  fieldPrice.value = hints.price || '';
  fieldSource.textContent = hints.source || '';
  fieldUrl.textContent = hints.url || '';
  fieldUrl.href = hints.url || '#';
  refreshPreviewFromFields();
}

async function requestHintsFromTab(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'MCCABE_GET_PRODUCT_HINTS' });
    if (res && res.ok && res.data) return res.data;
    if (res && res.ok === false && res.error) setStatus(`Could not read page: ${res.error}`, true);
  } catch (_) {
    // Inject path below
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js']
    });
  } catch (e) {
    setStatus('This page cannot be read by the extension (restricted URL). Edit fields manually.', true);
    const tab = await chrome.tabs.get(tabId);
    applyHints({
      title: tab.title || '',
      image: '',
      price: '',
      url: tab.url || '',
      source: safeHostname(tab.url)
    });
    return null;
  }

  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'MCCABE_GET_PRODUCT_HINTS' });
    if (res && res.ok && res.data) return res.data;
    if (res && res.ok === false && res.error) setStatus(`Could not read page: ${res.error}`, true);
  } catch (e2) {
    setStatus('Could not extract product hints. You can fill in details manually.', true);
  }
  return null;
}

function safeHostname(tabUrl) {
  try {
    return new URL(tabUrl).hostname.replace(/^www\./, '');
  } catch (_) {
    return '';
  }
}

async function init() {
  setStatus('Loading page hints…');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    setStatus('No active tab found.', true);
    btnSave.disabled = true;
    return;
  }

  const state = await loadState();
  populateBoardSelect(state.boards.length ? state.boards : ['Inspiration']);

  await refreshOnlineBoardsUi();

  const hints = await requestHintsFromTab(tab.id);
  if (hints) {
    applyHints(hints);
    setStatus('Review and edit, then choose a board to save.');
  } else if (!statusEl.textContent.includes('restricted')) {
    const tabPeek = await chrome.tabs.get(tab.id);
    applyHints({
      title: tabPeek.title || '',
      image: '',
      price: '',
      url: tabPeek.url || '',
      source: safeHostname(tabPeek.url)
    });
    if (!statusEl.textContent) {
      setStatus('Limited data available — please fill title, price, or image manually.');
    }
  }

  fieldImage.addEventListener('input', refreshPreviewFromFields);
  boardSelect.addEventListener('change', toggleNewBoardRow);

  if (chrome.cookies && chrome.cookies.onChanged) {
    chrome.cookies.onChanged.addListener((change) => {
      const d = change.cookie?.domain ?? '';
      if (!d.includes('mccabestheaterandliving.com')) return;
      void refreshOnlineBoardsUi();
    });
  }

  linkLocalBoards.addEventListener('click', () => {
    const url = chrome.runtime.getURL('boards.html');
    chrome.tabs.create({ url });
  });

  btnSave.addEventListener('click', async () => {
    btnSave.disabled = true;
    setStatus('Saving…');

    const title = fieldTitle.value.trim();
    const image = fieldImage.value.trim();
    const price = fieldPrice.value.trim();
    const urlVal = fieldUrl.href && fieldUrl.href !== '#' ? fieldUrl.href.trim() : fieldUrl.textContent.trim();
    const source = fieldSource.textContent.trim() || safeHostname(urlVal);

    let boardName = boardSelect.value;
    if (boardName === BOARD_NEW_VALUE) {
      boardName = newBoardName.value.trim();
      if (!boardName) {
        setStatus('Enter a name for the new board.', true);
        btnSave.disabled = false;
        return;
      }
    }

    if (!title) {
      setStatus('Add a title before saving.', true);
      btnSave.disabled = false;
      return;
    }

    const item = {
      id: uuid(),
      title,
      image,
      price,
      url: urlVal,
      source,
      boardName,
      savedAt: new Date().toISOString()
    };

    try {
      const next = await loadState();
      if (!next.boards.includes(boardName)) {
        next.boards.push(boardName);
      }
      next.items.unshift(item);
      await persistState(next);
      const syncRes = await syncToMccabesAccount(item);
      populateBoardSelect(next.boards);
      boardSelect.value = boardName;
      newBoardName.value = '';
      toggleNewBoardRow();

      if (syncRes.ok) {
        setStatus("Saved on this device and to your McCabe's account. Open My Boards on mccabes.com.");
      } else if (syncRes.reason === 'no_store_tab') {
        setStatus(
          "Saved locally. Open mccabes.com in a Chrome tab while signed in, then save again to add this item to your account."
        );
      } else if (syncRes.reason === 'sign_in_required') {
        setStatus(
          "Saved locally. Sign in on mccabes.com—then save again with a store tab open to sync to My Boards."
        );
      } else if (syncRes.reason === 'server_error') {
        setStatus('Saved locally. Account sync was rejected—check that /v/vspfiles/boards/ is deployed.', true);
      } else {
        setStatus(
          'Saved locally. Could not sync to your account yet (try a mccabes.com tab signed in).',
          true
        );
      }
    } catch (e) {
      setStatus('Save failed. Please try again.', true);
      void e;
    } finally {
      btnSave.disabled = false;
    }
  });
}

init();
