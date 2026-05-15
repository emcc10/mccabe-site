const STORAGE_KEY = 'mccabe_board_v1';

const noticeEl = document.getElementById('notice');
const boardSections = document.getElementById('boardSections');
const emptyEl = document.getElementById('empty');

function setNotice(text, asError = false) {
  noticeEl.textContent = text || '';
  noticeEl.classList.toggle('error', Boolean(asError));
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

function groupByBoard(items) {
  const map = new Map();
  for (const item of items) {
    const key = item.boardName || 'Unassigned';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function render() {
  boardSections.innerHTML = '';
  loadState().then((state) => {
    if (!state.items.length) {
      emptyEl.classList.remove('hidden');
      return;
    }
    emptyEl.classList.add('hidden');

    const grouped = groupByBoard(state.items);
    const boardOrder = [...state.boards];
    for (const name of grouped.keys()) {
      if (!boardOrder.includes(name)) boardOrder.push(name);
    }

    for (const boardName of boardOrder) {
      const list = grouped.get(boardName);
      if (!list || !list.length) continue;

      const block = document.createElement('section');
      block.className = 'board-block';

      const h2 = document.createElement('h2');
      h2.textContent = boardName;
      block.appendChild(h2);

      const grid = document.createElement('div');
      grid.className = 'grid';

      for (const item of list) {
        const card = document.createElement('article');
        card.className = 'card';

        const img = document.createElement('img');
        if (item.image) {
          img.src = item.image;
          img.alt = '';
          img.classList.add('visible');
        }

        const title = document.createElement('p');
        title.className = 'card-title';
        title.textContent = item.title;

        const meta = document.createElement('p');
        meta.className = 'meta';
        const priceLine = item.price ? item.price : 'Price not captured';
        meta.textContent = `${priceLine} · ${item.source || 'unknown source'}`;

        const link = document.createElement('a');
        link.className = 'meta';
        link.href = item.url || '#';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'Open product page';

        const actions = document.createElement('div');
        actions.className = 'card-actions';
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn danger';
        del.textContent = 'Delete';
        del.addEventListener('click', async () => {
          del.disabled = true;
          setNotice('');
          try {
            const next = await loadState();
            next.items = next.items.filter((entry) => entry.id !== item.id);
            await persistState(next);
            setNotice('Removed from local storage.');
            render();
          } catch (e) {
            setNotice('Could not delete item.', true);
            del.disabled = false;
          }
        });
        actions.appendChild(del);

        card.append(img, title, meta, link, actions);
        grid.appendChild(card);
      }

      block.appendChild(grid);
      boardSections.appendChild(block);
    }
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') render();
});

render();
