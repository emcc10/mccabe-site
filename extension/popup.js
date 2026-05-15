const STORAGE_KEY = 'mccabe_board_v1';
const BOARD_NEW_VALUE = '__create_new_board__';

/** Production store — used for My Boards link + login detection. */
const MCCABES_STORE_ORIGIN = 'https://www.mccabestheaterandliving.com';
// TODO: point to the live inspiration-board URL when it ships (account area for now).
const MCCABES_MY_BOARDS_PATH = '/myaccount.asp';
const MCCABES_LOGIN_PATH = '/login.asp';

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
 * Volusion storefronts typically set CustomerID when a shopper is signed in.
 */
async function isLoggedInToMccabesStore() {
  if (!chrome.cookies || !chrome.cookies.get) return false;
  const storeUrl = `${MCCABES_STORE_ORIGIN}/`;

  const looksLikeSession = (value) =>
    Boolean(value && String(value).trim().length > 0 && String(value).trim() !== '0');

  try {
    const direct = await chrome.cookies.get({
      url: storeUrl,
      name: 'CustomerID'
    });
    if (direct && looksLikeSession(direct.value)) return true;
  } catch (_) {
    // continue
  }

  try {
    const domainCookies = await chrome.cookies.getAll({
      domain: '.mccabestheaterandliving.com'
    });
    return domainCookies.some(
      (c) => /^customerid$/i.test(c.name) && looksLikeSession(c.value)
    );
  } catch (_) {
    return false;
  }
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
 * Later: ship saved items to a signed-in McCabe's account / API.
 * @param {object} item
 */
async function syncToMccabesAccount(item) {
  void item;
  // TODO: Implement backend sync once McCabe's account + API are available.
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
      const c = change.cookie;
      if (!c || !/mccabestheaterandliving\.com$/i.test(c.domain || '')) return;
      if (!/^customerid$/i.test(c.name)) return;
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
      await syncToMccabesAccount(item);
      populateBoardSelect(next.boards);
      boardSelect.value = boardName;
      newBoardName.value = '';
      toggleNewBoardRow();
      const online = await isLoggedInToMccabesStore();
      setStatus(
        online
          ? 'Saved locally. Open My Boards on mccabes.com to review in your account.'
          : "Saved on this device. Sign in to McCabe's online, then use My Boards above."
      );
    } catch (e) {
      setStatus('Save failed. Please try again.', true);
      void e;
    } finally {
      btnSave.disabled = false;
    }
  });
}

init();
