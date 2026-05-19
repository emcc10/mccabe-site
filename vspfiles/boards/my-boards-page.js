(function () {
  'use strict';

  var API_LIST = '/v/vspfiles/boards/list.php';
  var API_DELETE = '/v/vspfiles/boards/delete.php';

  var msg = document.getElementById('mc-boards-msg');
  var root = document.getElementById('mc-boards-root');
  var tabs = document.getElementById('mc-boards-tabs');
  var signInLink = document.getElementById('mc-boards-signin');
  var yearEl = document.getElementById('mc-boards-year');

  var activeBoardFilter = '__all__';
  var lastGrouped = null;

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  function setMsg(text, kind) {
    if (!msg) return;
    msg.textContent = text || '';
    msg.classList.toggle('mc-boards__msg--err', kind === 'err');
    msg.classList.toggle('mc-boards__msg--ok', kind === 'ok');
  }

  function groupByBoard(items) {
    var map = {};
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var key = (it.boardName && String(it.boardName).trim()) || 'Inspiration';
      if (!map[key]) map[key] = [];
      map[key].push(it);
    }
    return map;
  }

  function formatSavedAt(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return '';
    }
  }

  function setSignedInUi(isSignedIn) {
    if (signInLink) {
      signInLink.classList.toggle('is-hidden', Boolean(isSignedIn));
    }
  }

  function renderTabs(boardNames, grouped) {
    if (!tabs) return;
    tabs.innerHTML = '';
    if (!boardNames.length || boardNames.length < 2) {
      tabs.hidden = true;
      return;
    }

    tabs.hidden = false;

    function addTab(label, value, count) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'mc-boards__tab' + (activeBoardFilter === value ? ' is-active' : '');
      btn.setAttribute('data-board', value);
      btn.textContent = label;
      if (typeof count === 'number') {
        var span = document.createElement('span');
        span.className = 'mc-boards__tab-count';
        span.textContent = '(' + count + ')';
        btn.appendChild(span);
      }
      btn.addEventListener('click', function () {
        activeBoardFilter = value;
        renderTabs(boardNames, grouped);
        applyBoardFilter();
      });
      tabs.appendChild(btn);
    }

    var total = 0;
    for (var t = 0; t < boardNames.length; t++) {
      total += grouped[boardNames[t]].length;
    }
    addTab('All boards', '__all__', total);

    for (var b = 0; b < boardNames.length; b++) {
      var name = boardNames[b];
      addTab(name, name, grouped[name].length);
    }
  }

  function applyBoardFilter() {
    if (!root) return;
    var sections = root.querySelectorAll('.mc-boards__group');
    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      var board = sec.getAttribute('data-board-name') || '';
      var show =
        activeBoardFilter === '__all__' || activeBoardFilter === board;
      sec.classList.toggle('is-filtered-out', !show);
    }
  }

  function emptyState(title, text, actionsHtml) {
    return (
      '<motion class="mc-boards__empty">' +
      '<h2 class="mc-boards__empty-title">' +
      title +
      '</h2>' +
      '<p class="mc-boards__empty-text">' +
      text +
      '</p>' +
      (actionsHtml
        ? '<div class="mc-boards__empty-actions">' + actionsHtml + '</div>'
        : '') +
      '</motion>'
    );
  }

  function cardEl(item) {
    var card = document.createElement('article');
    card.className = 'mc-boards__card';

    var thumb = document.createElement('div');
    thumb.className = 'mc-boards__thumb';

    if (item.image) {
      var img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = item.image;
      img.onerror = function () {
        thumb.classList.add('mc-boards__thumb--empty');
        thumb.textContent = 'No image';
        img.remove();
      };
      thumb.appendChild(img);
    } else {
      thumb.classList.add('mc-boards__thumb--empty');
      thumb.textContent = 'No image';
    }
    card.appendChild(thumb);

    var body = document.createElement('motion');
    body.className = 'mc-boards__card-body';

    var title = document.createElement('p');
    title.className = 'mc-boards__card-title';
    var titleText = item.title || 'Untitled';
    if (item.url) {
      var titleLink = document.createElement('a');
      titleLink.href = item.url;
      titleLink.target = '_blank';
      titleLink.rel = 'noopener noreferrer';
      titleLink.textContent = titleText;
      title.appendChild(titleLink);
    } else {
      title.textContent = titleText;
    }
    body.appendChild(title);

    if (item.price) {
      var price = document.createElement('p');
      price.className = 'mc-boards__price';
      price.textContent = item.price;
      body.appendChild(price);
    }

    var meta = document.createElement('p');
    meta.className = 'mc-boards__meta';
    meta.textContent = item.source || 'Unknown source';
    body.appendChild(meta);

    var saved = formatSavedAt(item.savedAt);
    if (saved) {
      var savedEl = document.createElement('p');
      savedEl.className = 'mc-boards__saved';
      savedEl.textContent = 'Saved ' + saved;
      body.appendChild(savedEl);
    }

    card.appendChild(body);

    var actions = document.createElement('div');
    actions.className = 'mc-boards__actions';

    if (item.url) {
      var a = document.createElement('a');
      a.className = 'mc-boards__link';
      a.href = item.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'View product';
      actions.appendChild(a);
    }

    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'mc-boards__btn mc-boards__btn--danger';
    del.textContent = 'Remove';
    del.onclick = async function () {
      del.disabled = true;
      try {
        var dr = await fetch(API_DELETE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id: item.id })
        });
        var dj = await dr.json().catch(function () {
          return {};
        });
        if (dr.ok && dj.ok) {
          await load();
        } else {
          setMsg('Could not remove that item.', 'err');
          del.disabled = false;
        }
      } catch (e2) {
        setMsg('Network error removing item.', 'err');
        del.disabled = false;
      }
    };
    actions.appendChild(del);
    card.appendChild(actions);

    return card;
  }

  async function load() {
    if (!root) return;
    setMsg('Loading your boards…');
    root.innerHTML = '';
    if (tabs) {
      tabs.hidden = true;
      tabs.innerHTML = '';
    }

    try {
      var res = await fetch(API_LIST, { credentials: 'include', cache: 'no-store' });
      var data = await res.json().catch(function () {
        return {};
      });

      if (res.status === 401 || (data && data.error === 'sign_in_required')) {
        setSignedInUi(false);
        setMsg('Sign in to view the items saved to your account.', 'err');
        root.innerHTML = emptyState(
          'Sign in to see your boards',
          'Your inspiration boards are tied to your McCabe&rsquo;s account. Sign in, then save items with the Chrome extension while shopping.',
          '<a class="mc-boards__btn" href="/login.asp">Sign in</a>' +
            '<a class="mc-boards__btn mc-boards__btn--danger" href="/">Continue shopping</a>'
        );
        return;
      }

      setSignedInUi(true);

      if (!data.ok || !Array.isArray(data.items)) {
        setMsg('Could not load your boards. Please try again in a moment.', 'err');
        return;
      }

      if (data.items.length === 0) {
        setMsg('');
        root.innerHTML = emptyState(
          'No saved items yet',
          'Install the &ldquo;Save to McCabe&rsquo;s Board&rdquo; Chrome extension, sign in on this site, and save products while you browse.',
          '<a class="mc-boards__btn" href="/">Start shopping</a>'
        );
        return;
      }

      var grouped = groupByBoard(data.items);
      lastGrouped = grouped;
      var boardNames = Object.keys(grouped).sort(function (a, b) {
        return a.localeCompare(b);
      });

      if (
        activeBoardFilter !== '__all__' &&
        boardNames.indexOf(activeBoardFilter) === -1
      ) {
        activeBoardFilter = '__all__';
      }

      setMsg(
        data.items.length +
          ' saved item' +
          (data.items.length === 1 ? '' : 's') +
          ' across ' +
          boardNames.length +
          ' board' +
          (boardNames.length === 1 ? '' : 's') +
          '.',
        'ok'
      );

      renderTabs(boardNames, grouped);

      for (var b = 0; b < boardNames.length; b++) {
        var name = boardNames[b];
        var list = grouped[name];
        var section = document.createElement('section');
        section.className = 'mc-boards__group';
        section.setAttribute('data-board-name', name);
        section.id = 'mc-board-' + slugId(name);

        var head = document.createElement('div');
        head.className = 'mc-boards__group-head';

        var h2 = document.createElement('h2');
        h2.className = 'mc-boards__group-title';
        h2.textContent = name;
        head.appendChild(h2);

        var metaHead = document.createElement('p');
        metaHead.className = 'mc-boards__group-meta';
        metaHead.textContent =
          list.length + ' item' + (list.length === 1 ? '' : 's');
        head.appendChild(metaHead);

        section.appendChild(head);

        var grid = document.createElement('div');
        grid.className = 'mc-boards__grid';

        for (var k = 0; k < list.length; k++) {
          grid.appendChild(cardEl(list[k]));
        }
        section.appendChild(grid);
        root.appendChild(section);
      }

      applyBoardFilter();
    } catch (e) {
      setMsg('Network error loading boards.', 'err');
    }
  }

  function slugId(name) {
    return String(name)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'board';
  }

  load();
})();
