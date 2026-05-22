/**
 * Interactive hub: visual quiz, palette lab, room filters, saves, editorial feed.
 */
(function () {
  'use strict';

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
      h.textContent = 'Matching McCabe pieces';
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
        take.textContent = item.mccabeTake ? 'McCabe take: ' + item.mccabeTake : '';
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
          btn('See McCabe pieces', 'mc-boards__btn mc-boards__btn--ghost', function () {
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
