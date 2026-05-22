(function () {
  'use strict';

  if (window.__MC_BOARDS_PAGE_SCRIPT_LOADED) return;
  window.__MC_BOARDS_PAGE_SCRIPT_LOADED = true;

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
  var lifestyleEl =
    document.getElementById('mc-boards-lifestyle-grid') ||
    document.getElementById('mc-boards-lifestyle');
  var styleGuideEl = document.getElementById('mc-boards-style-guide');
  var trendsEl = document.getElementById('mc-boards-trends');
  var typesEl = document.getElementById('mc-boards-types');
  var signInLink = document.getElementById('mc-boards-signin');
  var yearEl = document.getElementById('mc-boards-year');
  var accountBanner = document.getElementById('mc-boards-account-banner');
  var quizEl = document.getElementById('mc-boards-quiz-app');
  var wheelEl = document.getElementById('mc-boards-palette-app');
  var triptychEl = document.getElementById('mc-boards-triptych');
  var splitEl = document.getElementById('mc-boards-split');
  var catalogEl = document.getElementById('mc-boards-catalog');

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
    var map = config.catalogPhotos || {};
    if (map[sku]) return map[sku];
    return '/v/vspfiles/photos/' + sku + '-01-1.jpg';
  }

  function resolveProductImage(product) {
    if (!product) return '';
    if (product.catalogPhoto) return product.catalogPhoto;
    var sku = product.id ? String(product.id).split('-')[0] : '';
    if (sku && config.catalogPhotos && config.catalogPhotos[sku]) {
      return config.catalogPhotos[sku];
    }
    if (product.image) return assetUrl(product.image);
    return '';
  }

  function productShopHref(product) {
    if (!product) return (config.shopBase || '/') + '/';
    var base = config.shopBase || 'https://www.mccabestheaterandliving.com';
    if (product.shopUrl) return base + product.shopUrl;
    if (product.sku) {
      return base + '/SearchResults.asp?Search=' + encodeURIComponent(product.sku);
    }
    return base + '/';
  }

  function resolveStyleImage(style) {
    if (!style) return '';
    if (style.catalogPhoto) return style.catalogPhoto;
    if (style.catalogSku && config.catalogPhotos && config.catalogPhotos[style.catalogSku]) {
      return config.catalogPhotos[style.catalogSku];
    }
    if (style.moodImage) return assetUrl(style.moodImage);
    return '';
  }

  function bindImgFallback(img, styleId, productId, showcasePath) {
    if (!img) return;
    img.addEventListener('error', function () {
      var step = img.getAttribute('data-mc-fallback') || '0';
      if (step === '2') return;
      if (step === '0') {
        var photo = catalogPhotoUrl(productId);
        if (photo && img.src.indexOf(photo) === -1) {
          img.setAttribute('data-mc-fallback', '1');
          img.src = photo;
          return;
        }
        if (showcasePath && img.src.indexOf(showcasePath) === -1) {
          img.setAttribute('data-mc-fallback', '1');
          img.src = assetUrl(showcasePath);
          return;
        }
      }
      img.setAttribute('data-mc-fallback', '2');
      img.removeAttribute('src');
      img.classList.add('mc-boards__img--missing');
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

  function shuffleFeatured() {
    var pool = (config.products || []).slice();
    if (pool.length < 3) return;
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    config.featuredTriptych = pool.slice(0, 3).map(function (p) {
      return p.id;
    });
    renderTriptych();
    if (triptychEl) {
      triptychEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
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
        img.src = resolveProductImage(product);
        img.alt = product.name;
        img.loading = 'lazy';
        bindImgFallback(img, product.primaryStyle, product.id, product.image);
        wrap.appendChild(img);
        btn.appendChild(wrap);
        var lab = document.createElement('p');
        lab.className = 'mc-boards__triptych-label';
        lab.textContent = product.name;
        btn.appendChild(lab);
        if (product.type) {
          var meta = document.createElement('p');
          meta.className = 'mc-boards__triptych-meta';
          meta.textContent = product.type;
          btn.appendChild(meta);
        }
        if (style) {
          var sub = document.createElement('p');
          sub.className = 'mc-boards__triptych-style';
          sub.textContent = style.label;
          btn.appendChild(sub);
        }
        btn.addEventListener('click', function () {
          if (style) activateStyleFilter(style.id, false);
        });
        var shop = productShopHref(product);
        if (shop) {
          btn.setAttribute('data-shop-url', shop);
          btn.addEventListener('dblclick', function (ev) {
            ev.preventDefault();
            window.open(shop, '_blank', 'noopener');
          });
        }
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
    if (product) {
      var shop = document.createElement('a');
      shop.className = 'mc-boards__btn mc-boards__btn--outline';
      shop.href = productShopHref(product);
      shop.target = '_blank';
      shop.rel = 'noopener noreferrer';
      shop.textContent = 'Shop ' + product.name;
      copy.appendChild(shop);
    }
    var media = document.createElement('div');
    media.className = 'mc-boards__split-media';
    if (product) {
      var img = document.createElement('img');
      img.src = resolveProductImage(product);
      img.alt = product.name;
      img.loading = 'lazy';
      bindImgFallback(img, style ? style.id : null, product.id, product.image);
      media.appendChild(img);
    }
    splitEl.appendChild(copy);
    splitEl.appendChild(media);
  }

  function renderCatalog() {
    if (!catalogEl) return;
    catalogEl.innerHTML = '';
    var products = config.products || [];
    for (var i = 0; i < products.length; i++) {
      (function (product) {
        var style = getStyleById(product.primaryStyle);
        var link = document.createElement('a');
        link.className = 'mc-boards__catalog-link';
        link.href = productShopHref(product);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        var card = document.createElement('article');
        card.className = 'mc-boards__catalog-card';
        var wrap = document.createElement('div');
        wrap.className = 'mc-boards__catalog-img';
        var img = document.createElement('img');
        img.src = resolveProductImage(product);
        img.alt = product.name;
        img.loading = 'lazy';
        bindImgFallback(img, product.primaryStyle, product.id, product.image);
        wrap.appendChild(img);
        card.appendChild(wrap);
        var name = document.createElement('p');
        name.className = 'mc-boards__catalog-name';
        name.textContent = product.name;
        card.appendChild(name);
        var type = document.createElement('p');
        type.className = 'mc-boards__catalog-type';
        type.textContent =
          (style ? style.label + ' · ' : '') + (product.type || '');
        card.appendChild(type);
        link.appendChild(card);
        catalogEl.appendChild(link);
      })(products[i]);
    }
  }

  function renderStyleLibrary() {
    refreshConfig();
    renderTriptych();
    renderCatalog();
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
        img.src = resolveStyleImage(style);
        img.alt = style.label;
        img.loading = 'lazy';
        bindImgFallback(img, style.id, style.catalogSku, style.moodImage);
        visual.appendChild(img);

        var body = document.createElement('div');
        body.className = 'mc-boards__style-body';
        var label = document.createElement('p');
        label.className = 'mc-boards__style-label';
        label.textContent = style.label;
        body.appendChild(label);
        var tag = document.createElement('p');
        tag.className = 'mc-boards__style-tagline';
        tag.textContent = style.tagline;
        body.appendChild(tag);

        btn.appendChild(visual);
        btn.appendChild(body);

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
    /* editorial/quiz/palette: MC_BOARDS_HUB */
    renderStyleGuide();
    renderFurnitureTypes();
  }

  function applyRoomFilters(filter) {
    if (!lifestyleEl) return;
    var cards = lifestyleEl.querySelectorAll('.mc-boards__lifestyle-card');
    var looks = config.lifestyleLooks || [];
    for (var i = 0; i < cards.length; i++) {
      var lookId = cards[i].getAttribute('data-look-id');
      var look = null;
      for (var j = 0; j < looks.length; j++) {
        if (looks[j].id === lookId) {
          look = looks[j];
          break;
        }
      }
      var show = true;
      if (filter.style && look && look.styleId !== filter.style) show = false;
      if (filter.room && look && look.room !== filter.room) show = false;
      if (filter.mood && look && look.mood !== filter.mood) show = false;
      cards[i].style.display = show ? '' : 'none';
    }
  }

  function renderFurnitureTypes() {
    if (!typesEl) return;
    typesEl.innerHTML = '';
    var list = config.furnitureTypes || [];
    for (var i = 0; i < list.length; i++) {
      (function (ft) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'mc-boards__type-chip';
        btn.setAttribute('role', 'listitem');
        var title = document.createElement('span');
        title.className = 'mc-boards__type-chip-label';
        title.textContent = ft.label;
        btn.appendChild(title);
        if (ft.desc) {
          var desc = document.createElement('span');
          desc.className = 'mc-boards__type-chip-desc';
          desc.textContent = ft.desc;
          btn.appendChild(desc);
        }
        btn.addEventListener('click', function () {
          var cat = document.getElementById('mc-boards-catalog');
          if (cat) cat.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        typesEl.appendChild(btn);
      })(list[i]);
    }
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
        if (style) {
          var visual = document.createElement('div');
          visual.className = 'mc-boards__trend-visual';
          var tim = document.createElement('img');
          tim.src = resolveStyleImage(style);
          tim.alt = style.label;
          tim.loading = 'lazy';
          visual.appendChild(tim);
          card.appendChild(visual);
        }
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
      '<p><strong>Sign in</strong> on McCabe&apos;s Theater &amp; Living to sync saved pieces to this page. ' +
      (note || 'You can still explore styles and room looks above.') +
      '</p><p class="mc-boards__account-actions">' +
      '<a class="mc-boards__btn" href="/login.asp">Sign in</a> ' +
      '<a class="mc-boards__btn mc-boards__btn--ghost" href="/myaccount.asp">My account</a></p>';
  }

  function renderLifestyleLooks() {
    if (!lifestyleEl) return;
    lifestyleEl.innerHTML = '';
    var looks = config.lifestyleLooks || [];
    var hub = window.MC_BOARDS_HUB;
    var roomFilter = hub ? hub.getRoomFilter() : {};

    for (var i = 0; i < looks.length; i++) {
      (function (look) {
        var style = getStyleById(look.styleId);
        var product = getProductById(look.productId);

        var card = document.createElement('article');
        card.className =
          'mc-boards__lifestyle-card' +
          (activeStyleFilter === look.styleId ? ' is-active' : '');
        card.setAttribute('role', 'listitem');
        card.setAttribute('data-look-id', look.id);
        card.setAttribute('data-style-id', look.styleId);

        var show = true;
        if (roomFilter.style && look.styleId !== roomFilter.style) show = false;
        if (roomFilter.room && look.room !== roomFilter.room) show = false;
        if (roomFilter.mood && look.mood !== roomFilter.mood) show = false;
        if (!show) card.style.display = 'none';

        var imgWrap = document.createElement('div');
        imgWrap.className = 'mc-boards__lifestyle-img';
        var prod = document.createElement('img');
        prod.src = look.image
          ? look.image.indexOf('/v/') === 0
            ? look.image
            : assetUrl(look.image)
          : product
            ? resolveProductImage(product)
            : '';
        prod.alt = product ? product.name : look.title;
        prod.loading = 'lazy';
        bindImgFallback(prod, look.styleId, product ? product.id : null, look.image);
        imgWrap.appendChild(prod);
        card.appendChild(imgWrap);

        var cap = document.createElement('div');
        cap.className = 'mc-boards__lifestyle-cap';
        var styleTag = document.createElement('p');
        styleTag.className = 'mc-boards__lifestyle-style';
        styleTag.textContent = style ? style.label : look.styleId;
        cap.appendChild(styleTag);
        var title = document.createElement('p');
        title.className = 'mc-boards__lifestyle-title';
        title.textContent = look.title;
        cap.appendChild(title);
        if (look.accents && look.accents.length) {
          var chips = document.createElement('div');
          chips.className = 'mc-boards__palette-chips';
          for (var a = 0; a < Math.min(look.accents.length, 4); a++) {
            var sw = document.createElement('span');
            sw.className = 'mc-boards__palette-chip';
            sw.style.backgroundColor = look.accents[a];
            chips.appendChild(sw);
          }
          cap.appendChild(chips);
        }
        card.appendChild(cap);

        var actions = document.createElement('div');
        actions.className = 'mc-boards__btn-row';
        var viewBtn = document.createElement('button');
        viewBtn.type = 'button';
        viewBtn.className = 'mc-boards__btn mc-boards__btn--ghost';
        viewBtn.textContent = 'View style';
        viewBtn.addEventListener('click', function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          activateStyleFilter(look.styleId, true);
          var stylesSec = document.getElementById('mc-boards-styles');
          if (stylesSec) stylesSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (hub) hub.pushRecent(look.id);
        });
        actions.appendChild(viewBtn);
        if (product) {
          var shop = document.createElement('a');
          shop.className = 'mc-boards__btn mc-boards__btn--ghost';
          shop.href = productShopHref(product);
          shop.target = '_blank';
          shop.rel = 'noopener noreferrer';
          shop.textContent = 'Shop piece';
          actions.appendChild(shop);
        }
        if (hub) {
          var saveBtn = document.createElement('button');
          saveBtn.type = 'button';
          saveBtn.className = 'mc-boards__btn mc-boards__btn--ghost';
          saveBtn.textContent = hub.isLookSaved(look.id) ? 'Saved' : 'Save look';
          saveBtn.addEventListener('click', function (ev) {
            ev.stopPropagation();
            hub.toggleSavedLook(look.id);
          });
          actions.appendChild(saveBtn);
        }
        card.appendChild(actions);

        card.addEventListener('click', function (ev) {
          if (ev.target.tagName === 'A' || ev.target.tagName === 'BUTTON') return;
          activateStyleFilter(look.styleId, false);
          if (hub) hub.pushRecent(look.id);
        });

        lifestyleEl.appendChild(card);
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
      bindImgFallback(thumb, prod.primaryStyle, prod.id, prod.image);
      thumb.src = resolveProductImage(prod);
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
          'If you are already signed in, try opening this page from the same browser tab where you logged in at mccabestheaterandliving.com.'
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
    window.__MC_BOARDS_APP_V2 = true;
    refreshConfig();
    setSignedInUi(domSignedInHint());
    setAccountBanner(domSignedInHint());
    if (window.MC_BOARDS_HUB && window.MC_BOARDS_HUB.init) {
      window.MC_BOARDS_HUB.init({
        config: config,
        getStyleById: getStyleById,
        getProductById: getProductById,
        activateStyleFilter: activateStyleFilter,
        resolveStyleImage: resolveStyleImage,
        resolveProductImage: resolveProductImage,
        productShopHref: productShopHref,
        applyRoomFilters: applyRoomFilters,
        renderLifestyleLooks: renderLifestyleLooks
      });
    } else if (msg) {
      setMsg('Style tools did not load — please hard refresh (Ctrl+Shift+R).', 'err');
    }
    renderStyleLibrary();
    var shuffleBtn = document.getElementById('mc-boards-shuffle');
    if (shuffleBtn && !shuffleBtn.__mcBound) {
      shuffleBtn.__mcBound = true;
      shuffleBtn.addEventListener('click', shuffleFeatured);
    }
    load();
  }

  function ensureBoardStyles(done) {
    refreshConfig();
    if (config.styles && config.styles.length) {
      done();
      return;
    }
    var src = API_BASE + 'board-styles.js?v=20260540';
    var tag = document.querySelector('script[src*="board-styles.js"]');
    if (tag) {
      refreshConfig();
      if (config.styles && config.styles.length) {
        done();
        return;
      }
      tag.addEventListener('load', function () {
        refreshConfig();
        done();
      });
      window.setTimeout(function () {
        refreshConfig();
        if (config.styles && config.styles.length) done();
      }, 400);
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


  /* MERGED_BOARDS_HUB */
  (function () {
  var LS_QUIZ = 'mc_boards_quiz_profile';
  var LS_PALETTE = 'mc_boards_palette_preset';
  var LS_SAVED_LOOKS = 'mc_boards_saved_looks';
  var LS_RECENT = 'mc_boards_recent_looks';

  var deps = {};
  var config = {};
  var quizStep = 0;
  var quizStyleScores = {};
  var quizVibes = {};
  var activeRoomFilter = { style: null, room: null, mood: null };
  var currentPalette = null;

  function readJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function writeJson(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      /* ignore */
    }
  }

  function el(id) {
    return document.getElementById(id);
  }

  function btn(text, className, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = className || 'mc-boards__btn';
    b.textContent = text;
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  function chip(label, active, onClick) {
    var c = btn(label, 'mc-boards__filter-chip' + (active ? ' is-active' : ''), onClick);
    return c;
  }

  function resolveProfileFromScores() {
    var profiles = config.styleProfiles || {};
    var vibeTotals = {};
    var keys = Object.keys(quizVibes);
    for (var i = 0; i < keys.length; i++) {
      vibeTotals[keys[i]] = (vibeTotals[keys[i]] || 0) + quizVibes[keys[i]];
    }
    var topVibe = 'cozy';
    var topV = -1;
    var vk = Object.keys(vibeTotals);
    for (var v = 0; v < vk.length; v++) {
      if (vibeTotals[vk[v]] > topV) {
        topV = vibeTotals[vk[v]];
        topVibe = vk[v];
      }
    }
    var vibeMap = {
      cozy: 'warm-transitional',
      tailored: 'collected-traditional',
      relaxed: 'soft-coastal',
      dramatic: 'moody-luxe',
      modern: 'modern-organic'
    };
    var byVibe = vibeMap[topVibe] || 'warm-transitional';
    if (profiles[byVibe]) return byVibe;

    var bestStyle = 'transitional';
    var bestS = -1;
    var sk = Object.keys(quizStyleScores);
    for (var s = 0; s < sk.length; s++) {
      if (quizStyleScores[sk[s]] > bestS) {
        bestS = quizStyleScores[sk[s]];
        bestStyle = sk[s];
      }
    }
    var styleMap = {
      traditional: 'collected-traditional',
      transitional: 'warm-transitional',
      modern: 'modern-organic',
      coastal: 'soft-coastal',
      'mid-century': 'warm-transitional',
      contemporary: 'moody-luxe'
    };
    return styleMap[bestStyle] || 'warm-transitional';
  }

  function renderRecommended(profileId, lede) {
    var sec = el('mc-boards-recommended');
    var grid = el('mc-boards-rec-grid');
    var ledeEl = el('mc-boards-rec-lede');
    if (!sec || !grid) return;
    var profile = (config.styleProfiles || {})[profileId];
    if (!profile) {
      sec.hidden = true;
      return;
    }
    sec.hidden = false;
    if (ledeEl) ledeEl.textContent = lede || profile.blurb;
    grid.innerHTML = '';
    var ids = profile.productIds || [];
    for (var i = 0; i < ids.length; i++) {
      var product = deps.getProductById(ids[i]);
      if (!product) continue;
      var link = document.createElement('a');
      link.className = 'mc-boards__catalog-link';
      link.href = deps.productShopHref(product);
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      var card = document.createElement('article');
      card.className = 'mc-boards__catalog-card';
      var wrap = document.createElement('div');
      wrap.className = 'mc-boards__catalog-img';
      var im = document.createElement('img');
      im.src = deps.resolveProductImage(product);
      im.alt = product.name;
      im.loading = 'lazy';
      wrap.appendChild(im);
      card.appendChild(wrap);
      var nm = document.createElement('p');
      nm.className = 'mc-boards__catalog-name';
      nm.textContent = product.name;
      card.appendChild(nm);
      link.appendChild(card);
      grid.appendChild(link);
    }
  }

  function renderVisualQuiz() {
    var root = el('mc-boards-quiz-app');
    var panel = el('mc-boards-quiz-result-panel');
    if (!root || !config.visualQuiz) return;

    var quiz = config.visualQuiz;
    quizStep = 0;
    quizStyleScores = {};
    quizVibes = {};
    if (panel) panel.hidden = true;

    function renderStep() {
      root.innerHTML = '';
      var questions = quiz.questions || [];
      if (quizStep >= questions.length) {
        showResult();
        return;
      }
      var q = questions[quizStep];
      var prompt = document.createElement('p');
      prompt.className = 'mc-boards__quiz-q';
      prompt.textContent = q.q;
      root.appendChild(prompt);

      var grid = document.createElement('div');
      grid.className = 'mc-boards__quiz-visual-grid';
      for (var i = 0; i < q.choices.length; i++) {
        (function (choice) {
          var card = document.createElement('button');
          card.type = 'button';
          card.className = 'mc-boards__quiz-visual-card';
          var imgWrap = document.createElement('div');
          imgWrap.className = 'mc-boards__quiz-visual-img';
          var img = document.createElement('img');
          img.src = choice.img;
          img.alt = choice.label;
          img.loading = 'lazy';
          imgWrap.appendChild(img);
          card.appendChild(imgWrap);
          var lab = document.createElement('span');
          lab.className = 'mc-boards__quiz-visual-label';
          lab.textContent = choice.label;
          card.appendChild(lab);
          card.addEventListener('click', function () {
            var sk = Object.keys(choice.scores || {});
            for (var k = 0; k < sk.length; k++) {
              quizStyleScores[sk[k]] = (quizStyleScores[sk[k]] || 0) + choice.scores[sk[k]];
            }
            if (choice.vibe) {
              quizVibes[choice.vibe] = (quizVibes[choice.vibe] || 0) + 1;
            }
            quizStep++;
            renderStep();
          });
          grid.appendChild(card);
        })(q.choices[i]);
      }
      root.appendChild(grid);
      var prog = document.createElement('p');
      prog.className = 'mc-boards__quiz-prog';
      prog.textContent = 'Question ' + (quizStep + 1) + ' of ' + questions.length;
      root.appendChild(prog);
    }

    function showResult() {
      root.innerHTML = '';
      var profileId = resolveProfileFromScores();
      var profile = (config.styleProfiles || {})[profileId];
      writeJson(LS_QUIZ, profileId);
      if (panel) {
        panel.hidden = false;
        panel.innerHTML = '';
        var h = document.createElement('h3');
        h.className = 'mc-boards__quiz-result-title';
        h.textContent = profile ? profile.title : profileId;
        panel.appendChild(h);
        var p = document.createElement('p');
        p.className = 'mc-boards__quiz-result-blurb';
        p.textContent = profile ? profile.blurb : '';
        panel.appendChild(p);
        if (profile && profile.palette) {
          var chips = document.createElement('div');
          chips.className = 'mc-boards__palette-chips';
          for (var i = 0; i < profile.palette.length; i++) {
            var sw = document.createElement('span');
            sw.className = 'mc-boards__palette-chip';
            sw.style.backgroundColor = profile.palette[i];
            chips.appendChild(sw);
          }
          panel.appendChild(chips);
        }
        var actions = document.createElement('div');
        actions.className = 'mc-boards__btn-row';
        actions.appendChild(
          btn('See matching pieces', 'mc-boards__btn', function () {
            renderRecommended(profileId, 'Pieces curated for your ' + (profile ? profile.title : '') + ' profile.');
            var rec = el('mc-boards-recommended');
            if (rec) rec.scrollIntoView({ behavior: 'smooth' });
            if (profile && profile.styleIds && profile.styleIds[0]) {
              deps.activateStyleFilter(profile.styleIds[0], false);
            }
          })
        );
        actions.appendChild(
          btn('Save result', 'mc-boards__btn mc-boards__btn--ghost', function () {
            writeJson(LS_QUIZ, profileId);
            alert('Style profile saved on this device.');
          })
        );
        actions.appendChild(
          btn('Retake quiz', 'mc-boards__btn mc-boards__btn--ghost', function () {
            if (panel) panel.hidden = true;
            renderVisualQuiz();
          })
        );
        panel.appendChild(actions);
      }
      renderRecommended(profileId, 'Based on your quiz: ' + (profile ? profile.title : profileId));
      if (profile && profile.styleIds && profile.styleIds[0]) {
        deps.activateStyleFilter(profile.styleIds[0], false);
      }
    }

    renderStep();
    var saved = readJson(LS_QUIZ, null);
    if (saved && config.styleProfiles && config.styleProfiles[saved]) {
      renderRecommended(saved, 'Welcome back — your saved style profile.');
    }
  }

  function shiftHex(hex, amount) {
    var n = parseInt(String(hex).replace('#', ''), 16);
    if (isNaN(n)) return hex;
    var r = Math.min(255, Math.max(0, ((n >> 16) & 255) + amount));
    var g = Math.min(255, Math.max(0, ((n >> 8) & 255) + amount));
    var b = Math.min(255, Math.max(0, (n & 255) + amount));
    return (
      '#' +
      [r, g, b]
        .map(function (x) {
          var h = x.toString(16);
          return h.length === 1 ? '0' + h : h;
        })
        .join('')
    );
  }

  function applyPalette(preset, variant) {
    if (!preset) return;
    currentPalette = preset;
    writeJson(LS_PALETTE, preset.id);
    var wall = preset.wall;
    if (variant === 'warmer') wall = shiftHex(wall, 12);
    if (variant === 'cooler') wall = shiftHex(wall, -12);
    if (variant === 'contrast') wall = shiftHex(wall, -28);

    var matches = el('mc-boards-palette-matches');
    var products = el('mc-boards-palette-products');
    if (!matches) return;

    matches.innerHTML = '';
    var wallSwatch = document.createElement('div');
    wallSwatch.className = 'mc-boards__palette-wall';
    wallSwatch.style.backgroundColor = wall;
    var wallLab = document.createElement('p');
    wallLab.className = 'mc-boards__palette-wall-label';
    wallLab.textContent = 'Wall color';
    matches.appendChild(wallSwatch);
    matches.appendChild(wallLab);

    var grid = document.createElement('div');
    grid.className = 'mc-boards__palette-match-grid';
    var rows = [
      ['Sofa / leather', preset.sofa],
      ['Rug', preset.rug],
      ['Wood', preset.wood],
      ['Accent', preset.accent],
      ['Paint pairing', preset.paintPair]
    ];
    for (var r = 0; r < rows.length; r++) {
      var row = document.createElement('div');
      row.className = 'mc-boards__palette-match-row';
      var k = document.createElement('span');
      k.className = 'mc-boards__palette-match-key';
      k.textContent = rows[r][0];
      var v = document.createElement('span');
      v.className = 'mc-boards__palette-match-val';
      v.textContent = rows[r][1];
      row.appendChild(k);
      row.appendChild(v);
      grid.appendChild(row);
    }
    matches.appendChild(grid);

    if (products) {
      products.innerHTML = '';
      var h = document.createElement('h3');
      h.className = 'mc-boards__tool-heading';
      h.textContent = 'Furniture that fits this palette';
      products.appendChild(h);
      var cat = document.createElement('div');
      cat.className = 'mc-boards__catalog';
      var ids = preset.productIds || [];
      for (var i = 0; i < ids.length; i++) {
        var product = deps.getProductById(ids[i]);
        if (!product) continue;
        var link = document.createElement('a');
        link.className = 'mc-boards__catalog-link';
        link.href = deps.productShopHref(product);
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        var card = document.createElement('article');
        card.className = 'mc-boards__catalog-card';
        var wrap = document.createElement('div');
        wrap.className = 'mc-boards__catalog-img';
        var im = document.createElement('img');
        im.src = deps.resolveProductImage(product);
        im.alt = product.name;
        wrap.appendChild(im);
        card.appendChild(wrap);
        var nm = document.createElement('p');
        nm.className = 'mc-boards__catalog-name';
        nm.textContent = product.name;
        card.appendChild(nm);
        link.appendChild(card);
        cat.appendChild(link);
      }
      products.appendChild(cat);
    }
    if (preset.styleIds && preset.styleIds[0]) {
      deps.activateStyleFilter(preset.styleIds[0], false);
    }
  }

  function renderPaletteLab() {
    var root = el('mc-boards-palette-app');
    if (!root || !config.paletteLab) return;
    root.innerHTML = '';

    var presets = config.paletteLab.presets || [];
    var presetRow = document.createElement('div');
    presetRow.className = 'mc-boards__palette-presets';
    for (var i = 0; i < presets.length; i++) {
      (function (pr) {
        presetRow.appendChild(
          chip(pr.label, currentPalette && currentPalette.id === pr.id, function () {
            applyPalette(pr, 'best');
          })
        );
      })(presets[i]);
    }
    root.appendChild(presetRow);

    var wheelWrap = document.createElement('div');
    wheelWrap.className = 'mc-boards__wheel-wrap';
    var disc = document.createElement('div');
    disc.className = 'mc-boards__wheel-disc';
    disc.setAttribute('aria-hidden', 'true');
    var wheelColors = ['#f4efe6', '#c8bfb2', '#8fa9b5', '#1e3a5f', '#a67c5b', '#4a4540', '#8a9a8c', '#6b4423'];
    var stops = [];
    for (var wd = 0; wd < wheelColors.length; wd++) {
      stops.push(wheelColors[wd] + ' ' + (((wd + 0.5) / wheelColors.length) * 100) + '%');
    }
    disc.style.background = 'conic-gradient(from 0deg, ' + stops.join(', ') + ')';
    var picks = document.createElement('div');
    picks.className = 'mc-boards__wheel-picks';
    for (var wi = 0; wi < wheelColors.length; wi++) {
      (function (hex) {
        var sw = document.createElement('button');
        sw.type = 'button';
        sw.className = 'mc-boards__wheel-swatch';
        sw.style.backgroundColor = hex;
        sw.title = hex;
        sw.addEventListener('click', function () {
          input.value = hex;
          input.dispatchEvent(new Event('input'));
        });
        picks.appendChild(sw);
      })(wheelColors[wi]);
    }
    wheelWrap.appendChild(disc);
    wheelWrap.appendChild(picks);
    root.appendChild(wheelWrap);

    var pickerRow = document.createElement('div');
    pickerRow.className = 'mc-boards__palette-picker';
    var lab = document.createElement('label');
    lab.className = 'mc-boards__palette-picker-label';
    lab.textContent = 'Custom wall color';
    var input = document.createElement('input');
    input.type = 'color';
    input.className = 'mc-boards__palette-input';
    input.value = '#f4efe6';
    input.addEventListener('input', function () {
      var custom = {
        id: 'custom',
        label: 'Custom wall',
        wall: input.value,
        sofa: 'Coordinate leather to wall undertone',
        rug: 'Neutral textured rug',
        wood: 'Medium walnut',
        accent: shiftHex(input.value, -40),
        paintPair: shiftHex(input.value, 20),
        styleIds: ['transitional'],
        productIds: ['40113-oxford-sofa', '77176-windsor-loveseat']
      };
      applyPalette(custom, 'best');
    });
    lab.appendChild(input);
    pickerRow.appendChild(lab);
    root.appendChild(pickerRow);

    var variants = document.createElement('div');
    variants.className = 'mc-boards__btn-row';
    variants.appendChild(
      btn('Best tonal match', 'mc-boards__btn mc-boards__btn--ghost', function () {
        if (currentPalette) applyPalette(currentPalette, 'best');
      })
    );
    variants.appendChild(
      btn('Warmer', 'mc-boards__btn mc-boards__btn--ghost', function () {
        if (currentPalette) applyPalette(currentPalette, 'warmer');
      })
    );
    variants.appendChild(
      btn('Cooler', 'mc-boards__btn mc-boards__btn--ghost', function () {
        if (currentPalette) applyPalette(currentPalette, 'cooler');
      })
    );
    variants.appendChild(
      btn('Higher contrast', 'mc-boards__btn mc-boards__btn--ghost', function () {
        if (currentPalette) applyPalette(currentPalette, 'contrast');
      })
    );
    root.appendChild(variants);

    var savedPreset = readJson(LS_PALETTE, null);
    if (savedPreset) {
      for (var p = 0; p < presets.length; p++) {
        if (presets[p].id === savedPreset) {
          applyPalette(presets[p], 'best');
          break;
        }
      }
    } else if (presets[0]) {
      applyPalette(presets[0], 'best');
    }
  }

  function renderRoomFilters() {
    var bar = el('mc-boards-room-filters');
    if (!bar) return;
    bar.innerHTML = '';

    function setFilter(key, val) {
      activeRoomFilter[key] = activeRoomFilter[key] === val ? null : val;
      renderRoomFilters();
      if (deps.applyRoomFilters) deps.applyRoomFilters(activeRoomFilter);
    }

    bar.appendChild(
      chip('All styles', !activeRoomFilter.style && !activeRoomFilter.room && !activeRoomFilter.mood, function () {
        activeRoomFilter = { style: null, room: null, mood: null };
        renderRoomFilters();
        if (deps.applyRoomFilters) deps.applyRoomFilters(activeRoomFilter);
      })
    );

    var styles = config.styles || [];
    for (var s = 0; s < styles.length; s++) {
      (function (st) {
        bar.appendChild(chip(st.label, activeRoomFilter.style === st.id, function () {
          setFilter('style', st.id);
        }));
      })(styles[s]);
    }

    var rooms = ['Living room', 'Great room', 'Home theater', 'Family room', 'Sunroom', 'Study', 'Reading nook'];
    for (var r = 0; r < rooms.length; r++) {
      (function (room) {
        bar.appendChild(chip(room, activeRoomFilter.room === room, function () {
          setFilter('room', room);
        }));
      })(rooms[r]);
    }

    var moods = [
      { id: 'cozy', label: 'Cozy' },
      { id: 'tailored', label: 'Tailored' },
      { id: 'relaxed', label: 'Relaxed' },
      { id: 'dramatic', label: 'Dramatic' },
      { id: 'modern', label: 'Modern' }
    ];
    for (var m = 0; m < moods.length; m++) {
      (function (mo) {
        bar.appendChild(chip(mo.label, activeRoomFilter.mood === mo.id, function () {
          setFilter('mood', mo.id);
        }));
      })(moods[m]);
    }
  }

  function toggleSavedLook(lookId) {
    var list = readJson(LS_SAVED_LOOKS, []);
    var idx = list.indexOf(lookId);
    if (idx === -1) list.push(lookId);
    else list.splice(idx, 1);
    writeJson(LS_SAVED_LOOKS, list);
    renderSavedLooks();
    if (deps.renderLifestyleLooks) deps.renderLifestyleLooks();
  }

  function pushRecent(lookId) {
    var list = readJson(LS_RECENT, []);
    list = list.filter(function (id) {
      return id !== lookId;
    });
    list.unshift(lookId);
    if (list.length > 8) list = list.slice(0, 8);
    writeJson(LS_RECENT, list);
    renderRecent();
  }

  function renderSavedLooks() {
    var row = el('mc-boards-saved-looks');
    if (!row) return;
    row.innerHTML = '';
    var ids = readJson(LS_SAVED_LOOKS, []);
    if (!ids.length) {
      row.textContent = 'No saved looks yet — use Save on any room card.';
      return;
    }
    for (var i = 0; i < ids.length; i++) {
      var look = (config.lifestyleLooks || []).filter(function (l) {
        return l.id === ids[i];
      })[0];
      if (!look) continue;
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'mc-boards__saved-chip';
      card.textContent = look.title;
      card.addEventListener('click', function () {
        var life = el('mc-boards-lifestyle');
        if (life) life.scrollIntoView({ behavior: 'smooth' });
      });
      row.appendChild(card);
    }
  }

  function renderRecent() {
    var row = el('mc-boards-recent');
    if (!row) return;
    row.innerHTML = '';
    var ids = readJson(LS_RECENT, []);
    if (!ids.length) {
      row.textContent = 'Open room looks to build your history.';
      return;
    }
    for (var i = 0; i < ids.length; i++) {
      var look = (config.lifestyleLooks || []).filter(function (l) {
        return l.id === ids[i];
      })[0];
      if (!look) continue;
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'mc-boards__saved-chip';
      card.textContent = look.title;
      row.appendChild(card);
    }
  }

  function renderEditorialFeed() {
    var root = el('mc-boards-trends');
    if (!root) return;
    root.innerHTML = '';
    var list = config.editorialFeed || config.decorTrends || [];
    for (var i = 0; i < list.length; i++) {
      (function (item) {
        var style = deps.getStyleById(item.styleId);
        var card = document.createElement('article');
        card.className = 'mc-boards__editorial-card';
        if (style) {
          var vis = document.createElement('div');
          vis.className = 'mc-boards__trend-visual';
          var im = document.createElement('img');
          im.src = deps.resolveStyleImage(style);
          im.alt = '';
          im.loading = 'lazy';
          vis.appendChild(im);
          card.appendChild(vis);
        }
        var tag = document.createElement('p');
        tag.className = 'mc-boards__trend-style';
        tag.textContent = style ? style.label : '';
        card.appendChild(tag);
        var h = document.createElement('h3');
        h.className = 'mc-boards__trend-title';
        h.textContent = item.title;
        card.appendChild(h);
        var ex = document.createElement('p');
        ex.className = 'mc-boards__trend-blurb';
        ex.textContent = item.excerpt || item.blurb || '';
        card.appendChild(ex);
        var take = document.createElement('p');
        take.className = 'mc-boards__mccabe-take';
        take.textContent = item.mccabeTake ? 'How we\'d style it: ' + item.mccabeTake : '';
        card.appendChild(take);
        if (item.sourceUrl) {
          var src = document.createElement('a');
          src.className = 'mc-boards__editorial-source';
          src.href = item.sourceUrl;
          src.target = '_blank';
          src.rel = 'noopener noreferrer';
          src.textContent = item.source || 'Source';
          card.appendChild(src);
        }
        var actions = document.createElement('div');
        actions.className = 'mc-boards__btn-row';
        actions.appendChild(
          btn('Shop this look', 'mc-boards__btn mc-boards__btn--ghost', function () {
            if (item.styleId) deps.activateStyleFilter(item.styleId, false);
          })
        );
        card.appendChild(actions);
        card.addEventListener('click', function (ev) {
          if (ev.target.tagName === 'A' || ev.target.tagName === 'BUTTON') return;
          if (item.styleId) deps.activateStyleFilter(item.styleId, false);
        });
        root.appendChild(card);
      })(list[i]);
    }
  }

  function wireShare() {
    var share = el('mc-boards-share');
    if (!share) return;
    share.addEventListener('click', function () {
      var url = location.href.split('#')[0];
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          share.textContent = 'Link copied';
          setTimeout(function () {
            share.textContent = 'Copy page link';
          }, 2000);
        });
      } else {
        prompt('Copy this link:', url);
      }
    });
  }

  window.MC_BOARDS_HUB = {
    init: function (d) {
      deps = d;
      config = d.config || window.MC_BOARD_STYLES || {};
      renderVisualQuiz();
      renderPaletteLab();
      renderRoomFilters();
      renderEditorialFeed();
      renderSavedLooks();
      renderRecent();
      wireShare();
    },
    toggleSavedLook: toggleSavedLook,
    pushRecent: pushRecent,
    isLookSaved: function (id) {
      return readJson(LS_SAVED_LOOKS, []).indexOf(id) !== -1;
    },
    getRoomFilter: function () {
      return activeRoomFilter;
    }
  };
  })();

  function onReady() {
    ensureBoardStyles(startApp);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
