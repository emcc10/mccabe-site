(function () {
  'use strict';

  if (window.__MC_BOARDS_APP_STARTED) return;
  window.__MC_BOARDS_APP_STARTED = true;

  var API_BASE = window.MC_BOARDS_API_BASE || '/v/vspfiles/boards/';
  var API_LIST = API_BASE + 'list.php';
  var API_DELETE = API_BASE + 'delete.php';
  var API_SESSION = API_BASE + 'session.php';

  var config = window.MC_BOARD_STYLES || {
    styles: [],
    furnitureTypes: [],
    boardStyleHints: {},
    lifestyleLooks: [],
    products: [],
    decorTrends: [],
    styleQuiz: null,
    colorWheel: []
  };

  var msg = document.getElementById('mc-boards-msg');
  var root = document.getElementById('mc-boards-root');
  var tabs = document.getElementById('mc-boards-tabs');
  var stylesEl = document.getElementById('mc-boards-styles');
  var lifestyleEl = document.getElementById('mc-boards-lifestyle');
  var styleGuideEl = document.getElementById('mc-boards-style-guide');
  var typesEl = document.getElementById('mc-boards-types');
  var signInLink = document.getElementById('mc-boards-signin');
  var yearEl = document.getElementById('mc-boards-year');
  var accountBanner = document.getElementById('mc-boards-account-banner');
  var quizEl = document.getElementById('mc-boards-quiz');
  var wheelEl = document.getElementById('mc-boards-color-wheel');
  var wheelResult = document.getElementById('mc-boards-wheel-result');
  var triptychEl = document.getElementById('mc-boards-triptych');
  var splitEl = document.getElementById('mc-boards-split');

  var activeBoardFilter = '__all__';
  var activeStyleFilter = null;
  var quizStep = 0;
  var quizScores = {};

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  function assetUrl(path) {
    var p = String(path || '');
    if (/^https?:\/\//i.test(p)) return p;
    var rel = p
      .replace(/^\/v\/vspfiles\/boards\//, '')
      .replace(/^\/vspfiles\/boards\//, '')
      .replace(/^\//, '');
    return API_BASE + rel;
  }

  function refreshConfig() {
    if (window.MC_BOARD_STYLES && typeof window.MC_BOARD_STYLES === 'object') {
      config = window.MC_BOARD_STYLES;
    }
  }

  function catalogPhotoUrl(productIdOrSku) {
    if (!productIdOrSku) return '';
    var sku = String(productIdOrSku);
    if (sku.indexOf('-') !== -1) sku = sku.split('-')[0];
    if (!/^\d+$/.test(sku)) return '';
    return '/v/vspfiles/photos/' + sku + '-01-1.jpg';
  }

  function bindImgFallback(img, styleId, productId) {
    if (!img) return;
    img.addEventListener('error', function () {
      var step = img.getAttribute('data-mc-fallback') || '0';
      if (step === '2') return;
      if (step === '0') {
        var photo = catalogPhotoUrl(productId);
        if (photo) {
          img.setAttribute('data-mc-fallback', '1');
          img.src = photo;
          return;
        }
      }
      img.setAttribute('data-mc-fallback', '2');
      var sid = styleId || 'transitional';
      img.src = assetUrl('mood/' + sid + '.svg');
    });
  }

  function readCookie(name) {
    var parts = String(document.cookie || '').split(';');
    for (var i = 0; i < parts.length; i++) {
      var bit = parts[i].trim();
      var eq = bit.indexOf('=');
      if (eq === -1) continue;
      if (bit.slice(0, eq).trim() === name) {
        return decodeURIComponent(bit.slice(eq + 1));
      }
    }
    return '';
  }

  function domSignedInHint() {
    if (!document.body) return false;
    if (document.body.classList.contains('mc-member-logged-in')) return true;
    var cookieNames = [
      'CustomerID',
      'customerid',
      'CustomerId',
      'Volusion_CustomerId',
      'VolusionCustomerID'
    ];
    for (var c = 0; c < cookieNames.length; c++) {
      var v = readCookie(cookieNames[c]);
      if (v && v !== '0') return true;
    }
    if (document.querySelector('a[href*="logout"]')) return true;
    var t = (document.body.innerText || '').toLowerCase();
    if (t.indexOf('log out') !== -1 || t.indexOf('logout') !== -1) return true;
    if (t.indexOf('my account') !== -1 && t.indexOf('sign in') === -1) return true;
    return false;
  }

  function setMsg(text, kind) {
    if (!msg) return;
    msg.textContent = text || '';
    msg.classList.toggle('mc-boards__msg--err', kind === 'err');
    msg.classList.toggle('mc-boards__msg--ok', kind === 'ok');
  }

  function getStyleById(id) {
    var list = config.styles || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return list[0] || null;
  }

  function resolveStyleForBoard(boardName) {
    var key = String(boardName || '').toLowerCase().trim();
    var hints = config.boardStyleHints || {};
    if (hints[key]) return getStyleById(hints[key]);
    var parts = key.split(/\s+/);
    for (var p = 0; p < parts.length; p++) {
      if (hints[parts[p]]) return getStyleById(hints[parts[p]]);
    }
    for (var hintKey in hints) {
      if (hints.hasOwnProperty(hintKey) && key.indexOf(hintKey) !== -1) {
        return getStyleById(hints[hintKey]);
      }
    }
    return getStyleById('transitional');
  }

  function inferFurnitureType(item) {
    var blob = (
      String(item.title || '') +
      ' ' +
      String(item.source || '') +
      ' ' +
      String(item.url || '')
    ).toLowerCase();
    if (/sectional|sofa|loveseat|chair|ottoman|seating/.test(blob)) return 'Seating';
    if (/theater|theatre|media|entertainment|tv/.test(blob)) return 'Media rooms';
    if (/dining|table|chair/.test(blob)) return 'Dining';
    if (/bed|mattress|nightstand|dresser/.test(blob)) return 'Bedroom';
    return 'Accents';
  }

  function getProductById(id) {
    var list = config.products || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function activateStyleFilter(styleId, scrollToBoard) {
    activeStyleFilter = styleId;
    renderStyleLibrary();
    renderLifestyleLooks();
    renderBoardTabsFromDom();
    applyBoardFilter();
    if (scrollToBoard) {
      var target = document.querySelector(
        '.mc-boards__group[data-style-id="' + styleId + '"]'
      );
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  function paletteEl(colors, className) {
    var wrap = document.createElement('div');
    wrap.className = className || 'mc-boards__palette';
    wrap.setAttribute('aria-label', 'Color palette');
    for (var i = 0; i < colors.length; i++) {
      var sw = document.createElement('span');
      sw.className = 'mc-boards__swatch';
      sw.style.backgroundColor = colors[i];
      sw.title = colors[i];
      wrap.appendChild(sw);
    }
    return wrap;
  }

  function renderTriptych() {
    if (!triptychEl) return;
    triptychEl.innerHTML = '';
    var ids = config.featuredTriptych || [];
    for (var i = 0; i < ids.length && i < 3; i++) {
      (function (productId) {
        var product = getProductById(productId);
        if (!product) return;
        var style = getStyleById(product.primaryStyle);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mc-boards__triptych-card';
        var wrap = document.createElement('div');
        wrap.className = 'mc-boards__triptych-img-wrap';
        var img = document.createElement('img');
        img.src = assetUrl(product.image);
        img.alt = product.name;
        img.loading = 'lazy';
        bindImgFallback(img, product.primaryStyle, productId);
        wrap.appendChild(img);
        btn.appendChild(wrap);
        var lab = document.createElement('p');
        lab.className = 'mc-boards__triptych-label';
        lab.textContent = product.name;
        btn.appendChild(lab);
        btn.addEventListener('click', function () {
          if (style) activateStyleFilter(style.id, false);
        });
        triptychEl.appendChild(btn);
      })(ids[i]);
    }
  }

  function renderSplit() {
    if (!splitEl) return;
    splitEl.innerHTML = '';
    var feat = config.splitFeature || {};
    var product = getProductById(feat.productId);
    var style = getStyleById(feat.styleId || (product && product.primaryStyle));
    var copy = document.createElement('div');
    copy.className = 'mc-boards__split-copy';
    var kicker = document.createElement('p');
    kicker.className = 'mc-boards__split-kicker';
    kicker.textContent = style ? style.label : '';
    copy.appendChild(kicker);
    var title = document.createElement('h3');
    title.className = 'mc-boards__split-title';
    title.textContent = feat.title || (product ? product.name : '');
    copy.appendChild(title);
    var text = document.createElement('p');
    text.className = 'mc-boards__split-text';
    text.textContent = feat.text || (style ? style.tagline : '');
    copy.appendChild(text);
    if (style) {
      var cta = document.createElement('button');
      cta.type = 'button';
      cta.className = 'mc-boards__btn';
      cta.textContent = 'View ' + style.label;
      cta.addEventListener('click', function () {
        activateStyleFilter(style.id, true);
      });
      copy.appendChild(cta);
    }
    var media = document.createElement('div');
    media.className = 'mc-boards__split-media';
    if (product) {
      var img = document.createElement('img');
      img.src = assetUrl(product.image);
      img.alt = product.name;
      img.loading = 'lazy';
      bindImgFallback(img, style ? style.id : null, product.id);
      media.appendChild(img);
    }
    splitEl.appendChild(copy);
    splitEl.appendChild(media);
  }

  function renderStyleLibrary() {
    refreshConfig();
    renderTriptych();
    renderSplit();
    if (!stylesEl) return;

    stylesEl.innerHTML = '';
    var styles = config.styles || [];

    for (var s = 0; s < styles.length; s++) {
      (function (style) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
          'mc-boards__style-card' +
          (activeStyleFilter === style.id ? ' is-active' : '');
        btn.setAttribute('role', 'listitem');
        btn.setAttribute('data-style-id', style.id);

        var visual = document.createElement('div');
        visual.className = 'mc-boards__style-visual';
        var img = document.createElement('img');
        img.src = assetUrl(style.moodImage);
        img.alt = style.label + ' interior mood';
        img.loading = 'lazy';
        bindImgFallback(img, style.id, style.catalogSku);
        visual.appendChild(img);

        var label = document.createElement('p');
        label.className = 'mc-boards__style-label';
        label.textContent = style.label;

        btn.appendChild(visual);
        btn.appendChild(label);

        btn.addEventListener('click', function () {
          if (activeStyleFilter === style.id) {
            activeStyleFilter = null;
            renderStyleLibrary();
            renderLifestyleLooks();
            renderBoardTabsFromDom();
            applyBoardFilter();
          } else {
            activateStyleFilter(style.id, true);
          }
        });

        stylesEl.appendChild(btn);
      })(styles[s]);
    }

    renderLifestyleLooks();
    renderQuiz();
    renderColorWheel();
  }

  function renderTrends() {
    if (!trendsEl) return;
    trendsEl.innerHTML = '';
    var list = config.decorTrends || [];
    for (var i = 0; i < list.length; i++) {
      (function (tr) {
        var card = document.createElement('article');
        card.className = 'mc-boards__trend-card';
        var style = getStyleById(tr.styleId);
        var tag = document.createElement('p');
        tag.className = 'mc-boards__trend-style';
        tag.textContent = style ? style.label : tr.styleId;
        card.appendChild(tag);
        var h3 = document.createElement('h3');
        h3.className = 'mc-boards__trend-title';
        h3.textContent = tr.title;
        card.appendChild(h3);
        var p = document.createElement('p');
        p.className = 'mc-boards__trend-blurb';
        p.textContent = tr.blurb;
        card.appendChild(p);
        if (tr.sources && tr.sources.length) {
          var links = document.createElement('p');
          links.className = 'mc-boards__trend-links';
          for (var s = 0; s < tr.sources.length; s++) {
            var a = document.createElement('a');
            a.href = tr.sources[s].url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.textContent = tr.sources[s].label;
            links.appendChild(a);
            if (s < tr.sources.length - 1) {
              links.appendChild(document.createTextNode(' · '));
            }
          }
          card.appendChild(links);
        }
        card.addEventListener('click', function () {
          activateStyleFilter(tr.styleId, false);
        });
        trendsEl.appendChild(card);
      })(list[i]);
    }
  }

  function renderColorWheel() {
    if (!wheelEl) return;
    wheelEl.innerHTML = '';
    var colors = config.colorWheel || [];
    if (!colors.length) return;

    var wrap = document.createElement('div');
    wrap.className = 'mc-boards__wheel-wrap';

    var disc = document.createElement('div');
    disc.className = 'mc-boards__wheel-disc';
    disc.setAttribute('aria-hidden', 'true');
    var stops = [];
    for (var d = 0; d < colors.length; d++) {
      var pct = ((d + 0.5) / colors.length) * 100;
      stops.push(colors[d].hex + ' ' + pct + '%');
    }
    disc.style.background =
      'conic-gradient(from 0deg, ' + stops.join(', ') + ')';

    var picks = document.createElement('div');
    picks.className = 'mc-boards__wheel-picks';
    picks.setAttribute('role', 'list');

    for (var i = 0; i < colors.length; i++) {
      (function (c) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mc-boards__wheel-swatch';
        btn.style.backgroundColor = c.hex;
        btn.title = c.label;
        btn.setAttribute('aria-label', c.label);
        btn.addEventListener('click', function () {
          picks.querySelectorAll('.mc-boards__wheel-swatch').forEach(function (el) {
            el.classList.remove('is-active');
          });
          btn.classList.add('is-active');
          var styleNames = (c.styles || [])
            .map(function (id) {
              var st = getStyleById(id);
              return st ? st.label : id;
            })
            .join(', ');
          if (wheelResult) {
            wheelResult.textContent = c.label + ' - ' + styleNames;
          }
          if (c.styles && c.styles[0]) {
            activateStyleFilter(c.styles[0], false);
          }
        });
        picks.appendChild(btn);
      })(colors[i]);
    }

    wrap.appendChild(disc);
    wrap.appendChild(picks);
    wheelEl.appendChild(wrap);
  }

  function renderQuiz() {
    if (!quizEl || !config.styleQuiz) return;
    var quiz = config.styleQuiz;
    quizStep = 0;
    quizScores = {};
    quizEl.innerHTML = '';

    function renderStep() {
      quizEl.innerHTML = '';
      var questions = quiz.questions || [];
      if (quizStep >= questions.length) {
        showQuizResult();
        return;
      }
      var q = questions[quizStep];
      var prompt = document.createElement('p');
      prompt.className = 'mc-boards__quiz-q';
      prompt.textContent = q.q;
      quizEl.appendChild(prompt);
      var list = document.createElement('div');
      list.className = 'mc-boards__quiz-choices';
      for (var i = 0; i < q.choices.length; i++) {
        (function (choice) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'mc-boards__quiz-btn';
          btn.textContent = choice.t;
          btn.addEventListener('click', function () {
            var keys = Object.keys(choice.s || {});
            for (var k = 0; k < keys.length; k++) {
              quizScores[keys[k]] = (quizScores[keys[k]] || 0) + choice.s[keys[k]];
            }
            quizStep++;
            renderStep();
          });
          list.appendChild(btn);
        })(q.choices[i]);
      }
      quizEl.appendChild(list);
      var prog = document.createElement('p');
      prog.className = 'mc-boards__quiz-prog';
      prog.textContent = 'Question ' + (quizStep + 1) + ' of ' + questions.length;
      quizEl.appendChild(prog);
    }

    function showQuizResult() {
      var bestId = 'transitional';
      var bestScore = -1;
      var ids = Object.keys(quizScores);
      for (var i = 0; i < ids.length; i++) {
        if (quizScores[ids[i]] > bestScore) {
          bestScore = quizScores[ids[i]];
          bestId = ids[i];
        }
      }
      var style = getStyleById(bestId);
      quizEl.innerHTML =
        '<p class="mc-boards__quiz-result">' +
        (style ? style.label : bestId) +
        '</p>';
      var again = document.createElement('button');
      again.type = 'button';
      again.className = 'mc-boards__btn mc-boards__btn--ghost';
      again.textContent = 'Take again';
      again.onclick = function () {
        renderQuiz();
      };
      quizEl.appendChild(again);
      activateStyleFilter(bestId, false);
    }

    renderStep();
  }

  function setAccountBanner(signedIn, note) {
    if (!accountBanner) return;
    if (signedIn) {
      accountBanner.className = 'mc-boards__account-banner mc-boards__account-banner--ok';
      accountBanner.innerHTML =
        '<p>Signed in — items saved with the Chrome extension appear below.</p>';
      return;
    }
    accountBanner.className = 'mc-boards__account-banner mc-boards__account-banner--warn';
    accountBanner.innerHTML =
      '<p><strong>Sign in</strong> on mccabes.com to sync saved pieces to this page. ' +
      (note || 'You can still explore styles and room looks above.') +
      '</p><p class="mc-boards__account-actions">' +
      '<a class="mc-boards__btn" href="/login.asp">Sign in</a> ' +
      '<a class="mc-boards__btn mc-boards__btn--ghost" href="/myaccount.asp">My account</a></p>';
  }

  function renderLifestyleLooks() {
    if (!lifestyleEl) return;
    lifestyleEl.innerHTML = '';
    var looks = config.lifestyleLooks || [];

    for (var i = 0; i < looks.length; i++) {
      (function (look) {
        var style = getStyleById(look.styleId);
        var product = getProductById(look.productId);

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className =
          'mc-boards__lifestyle-card' +
          (activeStyleFilter === look.styleId ? ' is-active' : '');
        btn.setAttribute('role', 'listitem');
        btn.setAttribute('data-style-id', look.styleId);

        var scene = document.createElement('div');
        scene.className = 'mc-boards__lifestyle-scene';

        var prod = document.createElement('img');
        prod.className = 'mc-boards__lifestyle-product';
        prod.src = assetUrl(look.image);
        prod.alt = product ? product.name : look.title;
        prod.loading = 'lazy';
        bindImgFallback(prod, look.styleId, look.productId);
        scene.appendChild(prod);

        btn.appendChild(scene);

        var title = document.createElement('p');
        title.className = 'mc-boards__lifestyle-title';
        title.textContent = look.title;
        btn.appendChild(title);

        btn.addEventListener('click', function () {
          if (activeStyleFilter === look.styleId) {
            activeStyleFilter = null;
            renderStyleLibrary();
            renderLifestyleLooks();
            renderBoardTabsFromDom();
            applyBoardFilter();
          } else {
            activateStyleFilter(look.styleId, true);
          }
        });

        lifestyleEl.appendChild(btn);
      })(looks[i]);
    }
  }

  function renderStyleGuide() {
    if (!styleGuideEl) return;
    var products = config.products || [];
    var styleList = config.styles || [];
    if (!products.length) {
      styleGuideEl.innerHTML = '';
      return;
    }

    var wrap = document.createElement('div');
    wrap.className = 'mc-boards__guide-table-wrap';

    var table = document.createElement('table');
    table.className = 'mc-boards__guide-table';
    table.innerHTML =
      '<thead><tr><th scope="col">Piece</th><th scope="col">Type</th>' +
      styleList
        .map(function (s) {
          return '<th scope="col">' + s.label + '</th>';
        })
        .join('') +
      '</tr></thead>';
    var tbody = document.createElement('tbody');

    for (var p = 0; p < products.length; p++) {
      var prod = products[p];
      var tr = document.createElement('tr');

      var nameCell = document.createElement('td');
      nameCell.className = 'mc-boards__guide-name';
      var thumb = document.createElement('img');
      thumb.src = assetUrl(prod.image);
      thumb.alt = '';
      thumb.loading = 'lazy';
      bindImgFallback(thumb, prod.primaryStyle);
      var nameSpan = document.createElement('span');
      nameSpan.textContent = prod.name;
      nameCell.appendChild(thumb);
      nameCell.appendChild(nameSpan);
      tr.appendChild(nameCell);

      var typeCell = document.createElement('td');
      typeCell.textContent = prod.type;
      tr.appendChild(typeCell);

      for (var si = 0; si < styleList.length; si++) {
        var sid = styleList[si].id;
        var cell = document.createElement('td');
        cell.className = 'mc-boards__guide-fit';
        if (prod.styles && prod.styles.indexOf(sid) !== -1) {
          var mark = document.createElement('span');
          mark.className =
            'mc-boards__guide-mark' +
            (prod.primaryStyle === sid ? ' mc-boards__guide-mark--primary' : '');
          mark.textContent = prod.primaryStyle === sid ? 'Primary' : 'Yes';
          mark.title =
            prod.primaryStyle === sid
              ? 'Best match for ' + styleList[si].label
              : 'Works with ' + styleList[si].label;
          cell.appendChild(mark);
        } else {
          cell.innerHTML = '<span class="mc-boards__guide-mark mc-boards__guide-mark--no">—</span>';
        }
        tr.appendChild(cell);
      }

      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    wrap.appendChild(table);
    styleGuideEl.innerHTML = '';
    styleGuideEl.appendChild(wrap);
  }

  function findBoardForStyle(styleId) {
    if (!root) return null;
    var sections = root.querySelectorAll('.mc-boards__group');
    for (var i = 0; i < sections.length; i++) {
      if (sections[i].getAttribute('data-style-id') === styleId) {
        return sections[i].getAttribute('data-board-name');
      }
    }
    return null;
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
    var prevLabel = tabs.previousElementSibling;
    if (prevLabel && prevLabel.classList.contains('mc-boards__section-label')) {
      prevLabel.remove();
    }
    if (!boardNames.length) {
      tabs.hidden = true;
      return;
    }

    tabs.hidden = boardNames.length < 2;

    var label = document.createElement('p');
    label.className = 'mc-boards__section-label';
    label.textContent = 'Your saved boards';
    tabs.parentNode.insertBefore(label, tabs);

    function addTab(btnLabel, value, count) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className =
        'mc-boards__tab' + (activeBoardFilter === value ? ' is-active' : '');
      btn.setAttribute('data-board', value);
      btn.textContent = btnLabel;
      if (typeof count === 'number') {
        var span = document.createElement('span');
        span.className = 'mc-boards__tab-count';
        span.textContent = '(' + count + ')';
        btn.appendChild(span);
      }
      btn.addEventListener('click', function () {
        activeBoardFilter = value;
        activeStyleFilter = null;
        renderStyleLibrary();
        renderLifestyleLooks();
        renderTabs(boardNames, grouped);
        applyBoardFilter();
      });
      tabs.appendChild(btn);
    }

    if (boardNames.length >= 2) {
      var total = 0;
      for (var x = 0; x < boardNames.length; x++) {
        total += grouped[boardNames[x]].length;
      }
      addTab('All boards', '__all__', total);
    }

    for (var b = 0; b < boardNames.length; b++) {
      var name = boardNames[b];
      addTab(name, name, grouped[name].length);
    }
  }

  function renderBoardTabsFromDom() {
    var sections = root ? root.querySelectorAll('.mc-boards__group') : [];
    var names = [];
    for (var i = 0; i < sections.length; i++) {
      names.push(sections[i].getAttribute('data-board-name'));
    }
    if (!names.length) return;
    var grouped = {};
    for (var n = 0; n < names.length; n++) {
      grouped[names[n]] = [];
    }
    var oldLabel = tabs && tabs.previousElementSibling;
    if (oldLabel && oldLabel.classList.contains('mc-boards__section-label')) {
      oldLabel.remove();
    }
    renderTabs(names, grouped);
  }

  function applyBoardFilter() {
    if (!root) return;
    var sections = root.querySelectorAll('.mc-boards__group');
    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      var board = sec.getAttribute('data-board-name') || '';
      var styleId = sec.getAttribute('data-style-id') || '';
      var showBoard =
        activeBoardFilter === '__all__' || activeBoardFilter === board;
      var showStyle = !activeStyleFilter || activeStyleFilter === styleId;
      sec.classList.toggle('is-filtered-out', !(showBoard && showStyle));
    }
  }

  function emptyStateRich(title, text, actionsHtml) {
    var moods = (config.styles || []).slice(0, 3);
    var imgs = moods
      .map(function (m) {
        return '<img src="' + m.moodImage + '" alt="" />';
      })
      .join('');
    return (
      '<div class="mc-boards__empty mc-boards__empty--rich">' +
      '<div class="mc-boards__empty-visual">' +
      imgs +
      '</div>' +
      '<div class="mc-boards__empty-inner">' +
      '<h2 class="mc-boards__empty-title">' +
      title +
      '</h2>' +
      '<p class="mc-boards__empty-text">' +
      text +
      '</p>' +
      (actionsHtml
        ? '<div class="mc-boards__empty-actions">' + actionsHtml + '</div>'
        : '') +
      '</div></div>'
    );
  }

  function cardEl(item, style) {
    var card = document.createElement('article');
    card.className = 'mc-boards__card';
    if (style && style.palette && style.palette[1]) {
      card.style.setProperty('--mc-card-accent', style.palette[1]);
    }

    var thumb = document.createElement('div');
    thumb.className = 'mc-boards__thumb';

    if (item.image) {
      var img = document.createElement('img');
      img.alt = item.title || 'Saved product';
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = item.image;
      img.onerror = function () {
        thumb.classList.add('mc-boards__thumb--empty');
        thumb.textContent = 'Image unavailable';
        img.remove();
      };
      thumb.appendChild(img);
    } else {
      thumb.classList.add('mc-boards__thumb--empty');
      thumb.textContent = 'Add image via extension';
    }
    card.appendChild(thumb);

    var body = document.createElement('div');
    body.className = 'mc-boards__card-body';

    var typeLine = document.createElement('p');
    typeLine.className = 'mc-boards__card-type';
    typeLine.textContent = inferFurnitureType(item);
    body.appendChild(typeLine);

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
      savedEl.textContent = 'Pinned ' + saved;
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

  function buildGroupSection(name, list) {
    var style = resolveStyleForBoard(name);
    var section = document.createElement('section');
    section.className = 'mc-boards__group';
    section.setAttribute('data-board-name', name);
    section.setAttribute('data-style-id', style ? style.id : 'transitional');
    section.id = 'mc-board-' + slugId(name);

    var banner = document.createElement('div');
    banner.className = 'mc-boards__mood-banner';

    var moodImgWrap = document.createElement('div');
    moodImgWrap.className = 'mc-boards__mood-image';
    var moodImg = document.createElement('img');
    moodImg.src = style ? style.moodImage : '';
    moodImg.alt = (style ? style.label : 'Board') + ' mood';
    moodImg.loading = 'lazy';
    moodImgWrap.appendChild(moodImg);

    var panel = document.createElement('div');
    panel.className = 'mc-boards__mood-panel';

    var styleLabel = document.createElement('p');
    styleLabel.className = 'mc-boards__group-style';
    styleLabel.textContent = style ? style.label + ' style' : 'Curated board';
    panel.appendChild(styleLabel);

    var h2 = document.createElement('h2');
    h2.className = 'mc-boards__group-title';
    h2.textContent = name;
    panel.appendChild(h2);

    var metaHead = document.createElement('p');
    metaHead.className = 'mc-boards__group-meta';
    metaHead.textContent =
      list.length +
      ' pinned piece' +
      (list.length === 1 ? '' : 's') +
      (style ? ' · ' + style.tagline : '');
    panel.appendChild(metaHead);

    if (style && style.palette) {
      panel.appendChild(paletteEl(style.palette, 'mc-boards__group-palette'));
    }

    banner.appendChild(moodImgWrap);
    banner.appendChild(panel);
    section.appendChild(banner);

    var grid = document.createElement('div');
    grid.className = 'mc-boards__grid';

    for (var k = 0; k < list.length; k++) {
      grid.appendChild(cardEl(list[k], style));
    }
    section.appendChild(grid);

    return section;
  }

  async function fetchBoardsData() {
    var sessionRes = await fetch(API_SESSION, {
      credentials: 'include',
      cache: 'no-store'
    });
    var sessionData = await sessionRes.json().catch(function () {
      return {};
    });
    if (sessionData && sessionData.ok && sessionData.signedIn) {
      return {
        signedIn: true,
        items: Array.isArray(sessionData.items) ? sessionData.items : []
      };
    }
    if (domSignedInHint()) {
      var listRes = await fetch(API_LIST, { credentials: 'include', cache: 'no-store' });
      var listData = await listRes.json().catch(function () {
        return {};
      });
      if (listRes.ok && listData && listData.ok) {
        return {
          signedIn: true,
          items: Array.isArray(listData.items) ? listData.items : []
        };
      }
    }
    var res = await fetch(API_LIST, { credentials: 'include', cache: 'no-store' });
    var data = await res.json().catch(function () {
      return {};
    });
    if (res.status === 401 || (data && data.error === 'sign_in_required')) {
      return { signedIn: false, items: [] };
    }
    if (data && data.ok) {
      return {
        signedIn: true,
        items: Array.isArray(data.items) ? data.items : []
      };
    }
    if (domSignedInHint()) {
      return { signedIn: true, items: [], error: true };
    }
    return { signedIn: false, items: [] };
  }

  async function load() {
    renderStyleLibrary();

    if (!root) return;
    setMsg('Loading your saved boards…');
    root.innerHTML = '';

    var oldLabel = tabs && tabs.previousElementSibling;
    if (oldLabel && oldLabel.classList.contains('mc-boards__section-label')) {
      oldLabel.remove();
    }
    if (tabs) {
      tabs.hidden = true;
      tabs.innerHTML = '';
    }

    try {
      var boardData = await fetchBoardsData();

      if (!boardData.signedIn) {
        setSignedInUi(false);
        setAccountBanner(
          false,
          'If you are already signed in, try opening this page from the same browser tab where you logged in at mccabes.com.'
        );
        setMsg('');
        root.innerHTML =
          '<div class="mc-boards__empty">' +
          '<h2 class="mc-boards__empty-title">Save pieces while you shop</h2>' +
          '<p class="mc-boards__empty-text">Use the Save to McCabe&rsquo;s Board extension after signing in. Your pins will show up here.</p>' +
          '</div>';
        return;
      }

      setSignedInUi(true);
      setAccountBanner(true);

      if (boardData.error) {
        setMsg('Could not reach the boards server. Showing studio tools only.', 'err');
        return;
      }

      var items = boardData.items;

      if (items.length === 0) {
        setMsg('Signed in — no saved items yet. Use the Chrome extension on any product page.');
        root.innerHTML =
          '<div class="mc-boards__empty">' +
          '<h2 class="mc-boards__empty-title">Your mood board is ready</h2>' +
          '<p class="mc-boards__empty-text">Name a board after a style, then save while browsing.</p>' +
          '<div class="mc-boards__empty-actions"><a class="mc-boards__btn" href="/">Explore furniture</a></div>' +
          '</div>';
        return;
      }

      var grouped = groupByBoard(items);
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
        items.length +
          ' pieces across ' +
          boardNames.length +
          ' board' +
          (boardNames.length === 1 ? '' : 's') +
          ' — organized by style and type.',
        'ok'
      );

      renderTabs(boardNames, grouped);

      for (var b = 0; b < boardNames.length; b++) {
        root.appendChild(buildGroupSection(boardNames[b], grouped[boardNames[b]]));
      }

      applyBoardFilter();
    } catch (e) {
      setMsg('Network error loading boards.', 'err');
    }
  }

  function slugId(name) {
    return (
      String(name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'board'
    );
  }

  function startApp() {
    if (window.__MC_BOARDS_APP_STARTED) return;
    if (
      !document.getElementById('mc-boards-main') &&
      !document.getElementById('mc-boards-styles')
    ) {
      return;
    }
    window.__MC_BOARDS_APP_STARTED = true;
    refreshConfig();
    setSignedInUi(domSignedInHint());
    setAccountBanner(domSignedInHint());
    renderStyleLibrary();
    load();
  }

  function ensureBoardStyles(done) {
    refreshConfig();
    if (config.styles && config.styles.length) {
      done();
      return;
    }
    var src = API_BASE + 'board-styles.js?v=20260527';
    var tag = document.querySelector('script[src*="board-styles.js"]');
    if (tag) {
      tag.addEventListener('load', function () {
        refreshConfig();
        done();
      });
      window.setTimeout(function () {
        refreshConfig();
        if (config.styles && config.styles.length) done();
      }, 150);
      return;
    }
    var s = document.createElement('script');
    s.src = src;
    s.onload = function () {
      refreshConfig();
      done();
    };
    s.onerror = function () {
      s.src = src.replace('/v/vspfiles/', '/vspfiles/');
    };
    (document.body || document.documentElement).appendChild(s);
  }

  function onReady() {
    ensureBoardStyles(startApp);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
