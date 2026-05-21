/**
 * Style library + curated McCabe product looks for inspiration boards.
 * Product PNGs: /v/vspfiles/boards/showcase/
 */
window.MC_BOARD_STYLES_BUILD = '20260536';
window.MC_BOARD_STYLES = {
  assetBases: ['/v/vspfiles/boards/', '/vspfiles/boards/'],

  /** Live Volusion product photos (use these first - showcase PNGs may not be deployed). */
  catalogPhotos: {
    '77696': '/v/vspfiles/photos/77696-1.jpg',
    '77180': '/v/vspfiles/photos/77180-01-1.jpg',
    '40109': '/v/vspfiles/photos/40109-01-1.jpg',
    '40113': '/v/vspfiles/photos/40113-01-1.jpg',
    '77176': '/v/vspfiles/photos/77176-A1-1.jpg',
    '41067': '/v/vspfiles/photos/40109-01-1.jpg',
    '41500': '/v/vspfiles/photos/40113-01-1.jpg'
  },

  decorTrends: [
    {
      title: 'Warm minimalism',
      styleId: 'transitional',
      blurb: 'Layered neutrals, soft leather, and quiet contrast—rooms feel calm but not cold.',
      sources: [
        { label: 'Houzz — Transitional Ideas', url: 'https://www.houzz.com/photos/transitional' },
        { label: 'AD — Neutral Interiors', url: 'https://www.architecturaldigest.com/topic/neutral' }
      ]
    },
    {
      title: 'Walnut & cognac comeback',
      styleId: 'mid-century',
      blurb: 'Low profiles, wood frames, and caramel leather anchor the space.',
      sources: [
        { label: 'Elle Decor — Mid-Century', url: 'https://www.elledecor.com/design-decor/interior-designers/glimpse-inside-midcentury-modern-home' }
      ]
    },
    {
      title: 'Media rooms in deep blue',
      styleId: 'contemporary',
      blurb: 'Navy upholstery and dimmable layers for theater-style lounging.',
      sources: [
        { label: 'House Beautiful — Home Theater', url: 'https://www.housebeautiful.com/room-decorating/theater-rooms/' }
      ]
    },
    {
      title: 'Performance leather & power comfort',
      styleId: 'transitional',
      blurb: 'Reclining sectionals with tailored stitching—comfort without bulk.',
      sources: [
        { label: 'Better Homes — Living Trends', url: 'https://www.bhg.com/decorating/' }
      ]
    },
    {
      title: 'Jewel-tone accents (edited)',
      styleId: 'contemporary',
      blurb: 'One rich accent per room—emerald, navy, or terracotta on a neutral field.',
      sources: [
        { label: 'Veranda — Color Trends', url: 'https://www.veranda.com/decorating-ideas/' }
      ]
    }
  ],

  styleQuiz: {
    title: 'What style are you?',
    questions: [
      {
        q: 'Which mood feels most like home?',
        choices: [
          { t: 'Tailored & timeless', s: { traditional: 2, transitional: 1 } },
          { t: 'Clean & edited', s: { modern: 2, contemporary: 1 } },
          { t: 'Sun-washed & easy', s: { coastal: 3 } },
          { t: 'Warm & vintage', s: { 'mid-century': 3 } }
        ]
      },
      {
        q: 'Pick a sofa silhouette:',
        choices: [
          { t: 'Plush recliner', s: { traditional: 2, transitional: 2 } },
          { t: 'Track-arm low profile', s: { modern: 3 } },
          { t: 'Walnut accent chair', s: { 'mid-century': 3 } },
          { t: 'Bold navy media sofa', s: { contemporary: 3 } }
        ]
      },
      {
        q: 'Your ideal palette:',
        choices: [
          { t: 'Cream & cognac', s: { traditional: 1, 'mid-century': 2, transitional: 1 } },
          { t: 'Greige & charcoal', s: { modern: 2, transitional: 2 } },
          { t: 'Sand & soft blue', s: { coastal: 3, transitional: 1 } },
          { t: 'Navy & brass', s: { contemporary: 3, modern: 1 } }
        ]
      },
      {
        q: 'Primary room to design:',
        choices: [
          { t: 'Family den', s: { traditional: 2, transitional: 2 } },
          { t: 'Open great room', s: { modern: 2, transitional: 1 } },
          { t: 'Home theater', s: { contemporary: 3 } },
          { t: 'Reading nook', s: { 'mid-century': 2, coastal: 1, modern: 1 } }
        ]
      }
    ]
  },

  colorWheel: [
    { id: 'cream', label: 'Ivory linen', hex: '#f4efe6', styles: ['transitional', 'coastal', 'traditional'] },
    { id: 'greige', label: 'Greige', hex: '#c8bfb2', styles: ['transitional', 'modern'] },
    { id: 'cognac', label: 'Cognac', hex: '#a67c5b', styles: ['mid-century', 'traditional', 'transitional'] },
    { id: 'charcoal', label: 'Charcoal', hex: '#4a4540', styles: ['modern', 'contemporary'] },
    { id: 'navy', label: 'Midnight navy', hex: '#1e3a5f', styles: ['contemporary'] },
    { id: 'sage', label: 'Sage', hex: '#8a9a8c', styles: ['coastal', 'transitional'] },
    { id: 'terracotta', label: 'Terracotta', hex: '#c67b4e', styles: ['mid-century', 'contemporary'] },
    { id: 'walnut', label: 'Walnut', hex: '#6b4423', styles: ['mid-century', 'traditional'] }
  ],

  featuredTriptych: [
    '77696-lux-cognac-chair',
    '77180-pacific-sofa',
    '40113-london-fog'
  ],

  splitFeature: {
    productId: '40109-atlantic-navy',
    styleId: 'contemporary',
    title: 'Atlantic Navy power seating',
    text:
      'Deep navy performance fabric, power recline, and scale made for media rooms. Pair with low lighting and tailored side tables for a finished theater look.'
  },

  styles: [
    {
      id: 'traditional',
      label: 'Traditional',
      tagline: 'Rich leather, generous comfort',
      catalogSku: '41067',
      moodImage: '/v/vspfiles/boards/showcase/traditional-carob-recliner-front.png',
      palette: ['#f4f4f4', '#c4a574', '#6b3f2a', '#3d2a22', '#8b5e3c']
    },
    {
      id: 'transitional',
      label: 'Transitional',
      tagline: 'Neutral leathers, balanced lines',
      catalogSku: '40113',
      moodImage: '/v/vspfiles/boards/showcase/transitional-london-fog-sofa-angle.png',
      palette: ['#f0f0f0', '#c8bfb2', '#9a8f82', '#5c534c', '#888888']
    },
    {
      id: 'modern',
      label: 'Modern',
      tagline: 'Track arms, edited silhouettes',
      catalogSku: '77180',
      moodImage: '/v/vspfiles/boards/showcase/modern-pacific-charcoal-sofa-angle.png',
      palette: ['#ececea', '#a8a8a4', '#5a5a56', '#2a2a28', '#7a8790']
    },
    {
      id: 'coastal',
      label: 'Coastal',
      tagline: 'Sun-washed neutrals',
      catalogSku: '40113',
      moodImage: '/v/vspfiles/boards/showcase/transitional-london-fog-sofa-angle.png',
      palette: ['#f5f5f5', '#d8d2c8', '#8fa9b5', '#5c7a86', '#c9b896']
    },
    {
      id: 'mid-century',
      label: 'Mid-Century',
      tagline: 'Walnut frame, cognac leather',
      catalogSku: '77696',
      moodImage: '/v/vspfiles/boards/showcase/mid-century-lux-cognac-chair-angle.png',
      palette: ['#f0f0f0', '#c67b4e', '#6b4423', '#2f4f4f', '#d4a574']
    },
    {
      id: 'contemporary',
      label: 'Contemporary',
      tagline: 'Bold color, power comfort',
      catalogSku: '40109',
      moodImage: '/v/vspfiles/boards/showcase/contemporary-atlantic-navy-recliner-front.png',
      palette: ['#e8eaed', '#5c6b7a', '#1e3a5f', '#152238', '#888888']
    }
  ],

  furnitureTypes: [
    { id: 'seating', label: 'Seating', desc: 'Sofas & sectionals' },
    { id: 'media', label: 'Media rooms', desc: 'Theater & entertainment' },
    { id: 'dining', label: 'Dining', desc: 'Tables & chairs' },
    { id: 'bedroom', label: 'Bedroom', desc: 'Beds & casegoods' },
    { id: 'accent', label: 'Accents', desc: 'Chairs, ottomans, decor' }
  ],

  /** McCabe catalog pieces with style tags (primary first). */
  products: [
    {
      id: '77696-lux-cognac-chair',
      name: 'Lux Cognac Chair',
      type: 'Accent chair',
      image: '/v/vspfiles/boards/showcase/mid-century-lux-cognac-chair-angle.png',
      catalogPhoto: '/v/vspfiles/photos/77696-1.jpg',
      styles: ['mid-century', 'transitional', 'modern'],
      primaryStyle: 'mid-century'
    },
    {
      id: '77180-pacific-sofa',
      name: 'Pacific Charcoal Sofa',
      type: 'Sofa',
      image: '/v/vspfiles/boards/showcase/modern-pacific-charcoal-sofa-angle.png',
      catalogPhoto: '/v/vspfiles/photos/77180-01-1.jpg',
      styles: ['modern', 'contemporary', 'transitional'],
      primaryStyle: 'modern'
    },
    {
      id: '77180-pacific-loveseat',
      name: 'Pacific Charcoal Loveseat',
      type: 'Loveseat',
      image: '/v/vspfiles/boards/showcase/modern-pacific-charcoal-loveseat-angle.png',
      catalogPhoto: '/v/vspfiles/photos/77180-01-1.jpg',
      styles: ['modern', 'contemporary', 'transitional'],
      primaryStyle: 'modern'
    },
    {
      id: '40109-atlantic-navy',
      name: 'Atlantic Navy Power Sofa',
      type: 'Power reclining sofa',
      image: '/v/vspfiles/boards/showcase/contemporary-atlantic-navy-recliner-front.png',
      catalogPhoto: '/v/vspfiles/photos/40109-01-1.jpg',
      styles: ['contemporary', 'modern'],
      primaryStyle: 'contemporary'
    },
    {
      id: '41067-carob-recliner',
      name: 'Carob Power Reclining Sofa',
      type: 'Power reclining sofa',
      image: '/v/vspfiles/boards/showcase/traditional-carob-recliner-front.png',
      catalogPhoto: '/v/vspfiles/photos/40109-01-1.jpg',
      styles: ['traditional', 'transitional'],
      primaryStyle: 'traditional'
    },
    {
      id: '41500-cognac-recliner',
      name: 'Cognac Power Reclining Sofa',
      type: 'Power reclining sofa',
      image: '/v/vspfiles/boards/showcase/transitional-cognac-recliner-front.png',
      catalogPhoto: '/v/vspfiles/photos/40113-01-1.jpg',
      styles: ['transitional', 'traditional'],
      primaryStyle: 'transitional'
    },
    {
      id: '77176-coachella-madeira',
      name: 'Coachella Madeira Sofa',
      type: 'Sofa',
      image: '/v/vspfiles/boards/showcase/transitional-coachella-madeira-sofa-front.png',
      catalogPhoto: '/v/vspfiles/photos/77176-A1-1.jpg',
      styles: ['transitional', 'modern', 'traditional'],
      primaryStyle: 'transitional'
    },
    {
      id: '40113-london-fog',
      name: 'London Fog Power Sofa',
      type: 'Power reclining sofa',
      image: '/v/vspfiles/boards/showcase/transitional-london-fog-sofa-angle.png',
      catalogPhoto: '/v/vspfiles/photos/40113-01-1.jpg',
      styles: ['transitional', 'coastal', 'contemporary'],
      primaryStyle: 'coastal'
    }
  ],

  /**
   * Lifestyle scenes: CSS room wash + product cutout (design-board presentation).
   */
  lifestyleLooks: [
    {
      id: 'mcm-cognac-lounge',
      styleId: 'mid-century',
      title: 'Cognac & walnut lounge',
      room: 'Living room',
      sceneClass: 'mc-scene--mcm',
      productId: '77696-lux-cognac-chair',
      image: '/v/vspfiles/boards/showcase/mid-century-lux-cognac-chair-angle.png',
      accents: ['#f0e6d8', '#c67b4e', '#2f4f4f', '#6b4423']
    },
    {
      id: 'modern-pacific-loft',
      styleId: 'modern',
      title: 'Pacific charcoal loft',
      room: 'Great room',
      sceneClass: 'mc-scene--modern',
      productId: '77180-pacific-sofa',
      image: '/v/vspfiles/boards/showcase/modern-pacific-charcoal-sofa-angle.png',
      accents: ['#ececea', '#7a8790', '#2a2a28', '#a8a8a4']
    },
    {
      id: 'contemporary-navy-media',
      styleId: 'contemporary',
      title: 'Atlantic navy media room',
      room: 'Home theater',
      sceneClass: 'mc-scene--contemporary',
      productId: '40109-atlantic-navy',
      image: '/v/vspfiles/boards/showcase/contemporary-atlantic-navy-recliner-angle.png',
      accents: ['#e8eaed', '#1e3a5f', '#5c6b7a', '#b8956b']
    },
    {
      id: 'traditional-carob-den',
      styleId: 'traditional',
      title: 'Carob leather den',
      room: 'Family room',
      sceneClass: 'mc-scene--traditional',
      productId: '41067-carob-recliner',
      image: '/v/vspfiles/boards/showcase/traditional-carob-recliner-recline.png',
      accents: ['#f4efe6', '#8b5e3c', '#3d2a22', '#c4a574']
    },
    {
      id: 'transitional-cognac-family',
      styleId: 'transitional',
      title: 'Warm cognac family room',
      room: 'Living room',
      sceneClass: 'mc-scene--transitional',
      productId: '41500-cognac-recliner',
      image: '/v/vspfiles/boards/showcase/transitional-cognac-recliner-angle.png',
      accents: ['#f0ebe4', '#b8956b', '#5c534c', '#9a6b42']
    },
    {
      id: 'coastal-london-fog',
      styleId: 'coastal',
      title: 'London fog coastal calm',
      room: 'Sunroom',
      sceneClass: 'mc-scene--coastal',
      productId: '40113-london-fog',
      image: '/v/vspfiles/boards/showcase/transitional-london-fog-sofa-angle.png',
      accents: ['#f5f3ee', '#8fa9b5', '#d8d2c8', '#c9b896']
    },
    {
      id: 'transitional-madeira-study',
      styleId: 'transitional',
      title: 'Madeira tailored sofa',
      room: 'Study',
      sceneClass: 'mc-scene--transitional-warm',
      productId: '77176-coachella-madeira',
      image: '/v/vspfiles/boards/showcase/transitional-coachella-madeira-sofa-angle.png',
      accents: ['#efe9e0', '#6b3f2a', '#4a4540', '#c4a574']
    },
    {
      id: 'modern-loveseat-nook',
      styleId: 'modern',
      title: 'Charcoal reading nook',
      room: 'Accent seating',
      sceneClass: 'mc-scene--modern-soft',
      productId: '77180-pacific-loveseat',
      image: '/v/vspfiles/boards/showcase/modern-pacific-charcoal-loveseat-angle.png',
      accents: ['#ececea', '#5a5a56', '#8a9a8c', '#2a2a28']
    }
  ],

  boardStyleHints: {
    inspiration: 'transitional',
    traditional: 'traditional',
    modern: 'modern',
    coastal: 'coastal',
    'mid-century': 'mid-century',
    'mid century': 'mid-century',
    mcm: 'mid-century',
    contemporary: 'contemporary',
    living: 'transitional',
    family: 'transitional',
    theater: 'contemporary',
    media: 'contemporary',
    den: 'traditional',
    dining: 'traditional',
    bedroom: 'coastal',
    navy: 'contemporary',
    cognac: 'mid-century',
    charcoal: 'modern',
    fog: 'coastal',
    carob: 'traditional'
  }
};

/** Paint grids from MC_BOARD_STYLES (runs before my-boards-page.js; survives stale cached page JS). */
window.renderBoardsPreview = function renderBoardsPreview() {
  var C = window.MC_BOARD_STYLES;
  if (!C || !C.styles || !C.styles.length) return false;

  function productById(id) {
    var list = C.products || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function styleById(id) {
    var list = C.styles || [];
    for (var j = 0; j < list.length; j++) {
      if (list[j].id === id) return list[j];
    }
    return null;
  }

  function imgSrc(p) {
    return (p && (p.catalogPhoto || p.image)) || '';
  }

  function styleImg(style) {
    if (!style) return '';
    if (style.moodImage) return style.moodImage;
    if (style.catalogSku && C.catalogPhotos && C.catalogPhotos[style.catalogSku]) {
      return C.catalogPhotos[style.catalogSku];
    }
    var list = C.products || [];
    for (var k = 0; k < list.length; k++) {
      if (list[k].primaryStyle === style.id) return imgSrc(list[k]);
    }
    return '';
  }

  var tri = document.getElementById('mc-boards-triptych');
  if (tri && !tri.children.length && C.featuredTriptych) {
    for (var t = 0; t < C.featuredTriptych.length && t < 3; t++) {
      var tp = productById(C.featuredTriptych[t]);
      if (!tp) continue;
      var tbtn = document.createElement('button');
      tbtn.type = 'button';
      tbtn.className = 'mc-boards__triptych-card';
      var tw = document.createElement('div');
      tw.className = 'mc-boards__triptych-img-wrap';
      var tim = document.createElement('img');
      tim.src = imgSrc(tp);
      tim.alt = tp.name;
      tim.loading = 'lazy';
      tw.appendChild(tim);
      tbtn.appendChild(tw);
      var tlab = document.createElement('p');
      tlab.className = 'mc-boards__triptych-label';
      tlab.textContent = tp.name;
      tbtn.appendChild(tlab);
      var tst = styleById(tp.primaryStyle);
      if (tst) {
        var tsub = document.createElement('p');
        tsub.className = 'mc-boards__triptych-style';
        tsub.textContent = tst.label;
        tbtn.appendChild(tsub);
      }
      tri.appendChild(tbtn);
    }
  }

  var cat = document.getElementById('mc-boards-catalog');
  if (cat && !cat.children.length && C.products) {
    for (var c = 0; c < C.products.length; c++) {
      var prod = C.products[c];
      var card = document.createElement('article');
      card.className = 'mc-boards__catalog-card';
      var cw = document.createElement('div');
      cw.className = 'mc-boards__catalog-img';
      var ci = document.createElement('img');
      ci.src = imgSrc(prod);
      ci.alt = prod.name;
      ci.loading = 'lazy';
      cw.appendChild(ci);
      card.appendChild(cw);
      var nm = document.createElement('p');
      nm.className = 'mc-boards__catalog-name';
      nm.textContent = prod.name;
      card.appendChild(nm);
      cat.appendChild(card);
    }
  }

  var grid = document.getElementById('mc-boards-styles');
  if (grid && !grid.children.length) {
    for (var s = 0; s < C.styles.length; s++) {
      var style = C.styles[s];
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mc-boards__style-card';
      btn.setAttribute('role', 'listitem');
      var visual = document.createElement('div');
      visual.className = 'mc-boards__style-visual';
      var sim = document.createElement('img');
      sim.src = styleImg(style);
      sim.alt = style.label;
      sim.loading = 'lazy';
      visual.appendChild(sim);
      var body = document.createElement('div');
      body.className = 'mc-boards__style-body';
      var label = document.createElement('p');
      label.className = 'mc-boards__style-label';
      label.textContent = style.label;
      body.appendChild(label);
      var tag = document.createElement('p');
      tag.className = 'mc-boards__style-tagline';
      tag.textContent = style.tagline || '';
      body.appendChild(tag);
      btn.appendChild(visual);
      btn.appendChild(body);
      grid.appendChild(btn);
    }
  }

  var life = document.getElementById('mc-boards-lifestyle');
  if (life && !life.children.length && C.lifestyleLooks) {
    for (var l = 0; l < C.lifestyleLooks.length; l++) {
      var look = C.lifestyleLooks[l];
      var prodL = productById(look.productId);
      var art = document.createElement('article');
      art.className = 'mc-boards__lifestyle-card';
      art.setAttribute('role', 'listitem');
      if (prodL) {
        var lw = document.createElement('div');
        lw.className = 'mc-boards__lifestyle-img';
        var lim = document.createElement('img');
        lim.src = imgSrc(prodL);
        lim.alt = look.title || prodL.name;
        lim.loading = 'lazy';
        lw.appendChild(lim);
        art.appendChild(lw);
      }
      var lt = document.createElement('p');
      lt.className = 'mc-boards__lifestyle-title';
      lt.textContent = look.title || '';
      art.appendChild(lt);
      life.appendChild(art);
    }
  }

  var trends = document.getElementById('mc-boards-trends');
  if (trends && !trends.children.length && C.decorTrends) {
    for (var d = 0; d < C.decorTrends.length; d++) {
      var tr = C.decorTrends[d];
      var tcard = document.createElement('article');
      tcard.className = 'mc-boards__trend-card';
      var th = document.createElement('h3');
      th.className = 'mc-boards__trend-title';
      th.textContent = tr.title;
      tcard.appendChild(th);
      var tb = document.createElement('p');
      tb.className = 'mc-boards__trend-blurb';
      tb.textContent = tr.blurb || '';
      tcard.appendChild(tb);
      trends.appendChild(tcard);
    }
  }

  var types = document.getElementById('mc-boards-types');
  if (types && !types.children.length && C.furnitureTypes) {
    for (var f = 0; f < C.furnitureTypes.length; f++) {
      var ft = C.furnitureTypes[f];
      var chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'mc-boards__type-chip';
      chip.setAttribute('role', 'listitem');
      chip.textContent = ft.label;
      types.appendChild(chip);
    }
  }

  return !!(tri && tri.children.length);
};

/** Ensure triptych/catalog exist on Volusion article embeds (old HTML omits these ids). */
(function () {
  function ensureShellIds() {
    if (document.getElementById('mc-boards-triptych')) return;

    var anchor =
      document.getElementById('mc-boards-styles') ||
      document.getElementById('mc-boards-main') ||
      document.querySelector('.mc-boards');

    if (!anchor) return;

    var parent = anchor.parentNode;
    if (!parent) return;

    function addSection(title, id, className) {
      if (document.getElementById(id)) return;
      var sec = document.createElement('section');
      sec.className = 'mc-boards__section';
      var h = document.createElement('h2');
      h.className = 'mc-boards__section-title';
      h.textContent = title;
      sec.appendChild(h);
      var el = document.createElement('div');
      el.id = id;
      el.className = className;
      sec.appendChild(el);
      parent.insertBefore(sec, anchor);
    }

    addSection('Featured pieces', 'mc-boards-triptych', 'mc-boards__triptych');
    addSection('Pieces on your boards', 'mc-boards-catalog', 'mc-boards__catalog');

    if (!document.getElementById('mc-boards-split')) {
      var split = document.createElement('section');
      split.className = 'mc-boards__split';
      split.id = 'mc-boards-split';
      parent.insertBefore(split, anchor);
    }
  }

  function loadPageJs() {
    if (window.__MC_BOARDS_APP_STARTED) return;
    if (document.querySelector('script[src*="my-boards-page.js"]')) return;
    var s = document.createElement('script');
    s.src = '/v/vspfiles/boards/my-boards-page.js?v=20260536';
    s.defer = true;
    document.body.appendChild(s);
  }

  function kick() {
    ensureShellIds();
    if (typeof window.renderBoardsPreview === 'function') {
      window.renderBoardsPreview();
    }
    loadPageJs();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', kick);
  } else {
    kick();
  }
})();
