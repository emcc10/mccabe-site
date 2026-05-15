(function () {
  'use strict';

  var API_LIST = '/v/vspfiles/boards/list.php';
  var API_DELETE = '/v/vspfiles/boards/delete.php';

  var msg = document.getElementById('mc-boards-msg');
  var root = document.getElementById('mc-boards-root');

  function setMsg(text, isErr) {
    msg.textContent = text || '';
    msg.classList.toggle('mc-boards__msg--err', Boolean(isErr));
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

  async function load() {
    setMsg('Loading…');
    root.innerHTML = '';
    try {
      var res = await fetch(API_LIST, { credentials: 'include', cache: 'no-store' });
      var data = await res.json().catch(function () {
        return {};
      });
      if (res.status === 401 || (data && data.error === 'sign_in_required')) {
        setMsg(
          'Sign in to see the items you have saved to your account.',
          true
        );
        root.innerHTML =
          '<div class="mc-boards__empty"><a class="mc-boards__link" href="/login.asp">Go to sign in</a></div>';
        return;
      }
      if (!data.ok || !Array.isArray(data.items)) {
        setMsg('Could not load your boards. Try again in a moment.', true);
        return;
      }
      if (data.items.length === 0) {
        setMsg('Nothing saved to your account yet. Use the Chrome extension on product pages to add items.');
        root.innerHTML =
          '<div class="mc-boards__empty">Install &ldquo;Save to McCabe&rsquo;s Board,&rdquo; then save while signed in on this site.</div>';
        return;
      }

      setMsg(data.items.length + ' item' + (data.items.length === 1 ? '' : 's') + ' in your account.');
      var grouped = groupByBoard(data.items);
      var boardNames = Object.keys(grouped).sort(function (a, b) {
        return a.localeCompare(b);
      });

      for (var b = 0; b < boardNames.length; b++) {
        var name = boardNames[b];
        var list = grouped[name];
        var section = document.createElement('section');
        section.className = 'mc-boards__group';
        var h2 = document.createElement('h2');
        h2.className = 'mc-boards__group-title';
        h2.textContent = name;
        section.appendChild(h2);

        var grid = document.createElement('div');
        grid.className = 'mc-boards__grid';

        for (var k = 0; k < list.length; k++) {
          grid.appendChild(cardEl(list[k]));
        }
        section.appendChild(grid);
        root.appendChild(section);
      }
    } catch (e) {
      setMsg('Network error loading boards.', true);
    }
  }

  function cardEl(item) {
    var card = document.createElement('article');
    card.className = 'mc-boards__card';

    if (item.image) {
      var img = document.createElement('img');
      img.alt = '';
      img.loading = 'lazy';
      img.src = item.image;
      img.className = 'mc-boards__img--on';
      img.onerror = function () {
        img.style.display = 'none';
      };
      card.appendChild(img);
    }

    var title = document.createElement('p');
    title.className = 'mc-boards__card-title';
    title.textContent = item.title || 'Untitled';
    card.appendChild(title);

    var meta = document.createElement('p');
    meta.className = 'mc-boards__meta';
    meta.textContent = (item.price || 'Price not captured') + ' · ' + (item.source || 'unknown');
    card.appendChild(meta);

    var actions = document.createElement('div');
    actions.className = 'mc-boards__actions';

    if (item.url) {
      var a = document.createElement('a');
      a.className = 'mc-boards__link';
      a.href = item.url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = 'Open product page';
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
          setMsg('Could not remove that item.', true);
          del.disabled = false;
        }
      } catch (e2) {
        setMsg('Network error removing item.', true);
        del.disabled = false;
      }
    };
    actions.appendChild(del);
    card.appendChild(actions);

    return card;
  }

  load();
})();
