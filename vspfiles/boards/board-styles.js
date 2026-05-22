/**
 * Style library + curated McCabe product looks for inspiration boards.
 * Product PNGs: /v/vspfiles/boards/showcase/
 */
window.MC_BOARD_STYLES_BUILD = '20260540';
window.MC_BOARD_STYLES = {
  assetBases: ['/v/vspfiles/boards/', '/vspfiles/boards/'],
  shopBase: 'https://www.mccabestheaterandliving.com',

  /** Live Volusion photos — one unique image per SKU (no shared placeholders). */
  catalogPhotos: {
    '77696': '/v/vspfiles/photos/77696-1.jpg',
    '77180': '/v/vspfiles/photos/77180-01-1.jpg',
    '77176': '/v/vspfiles/photos/77176-A1-1.jpg',
    '40109': '/v/vspfiles/photos/40109-01-1.jpg',
    '40112': '/v/vspfiles/photos/40112-01-1.jpg',
    '40113': '/v/vspfiles/photos/40113-01-1.jpg',
    '41067': '/v/vspfiles/photos/Washington%2041067-1.jpg',
    '41500': '/v/vspfiles/photos/Keiran-SC-67-10-9X-10-66-1.jpg',
    'Brookes': '/v/vspfiles/photos/Brookes-SC-92-15-1.jpg',
    'Essex': '/v/vspfiles/photos/Essex-SC-07-9W-08-1.jpg'
  },

  /** Display profiles surfaced by the visual quiz */
  styleProfiles: {
    'warm-transitional': {
      title: 'Warm Transitional',
      blurb: 'Soft neutrals, tailored upholstery, and layered texture — relaxed but refined.',
      styleIds: ['transitional', 'traditional'],
      palette: ['#f4efe6', '#c8bfb2', '#9a6b42', '#5c534c'],
      productIds: ['40113-oxford-sofa', '41500-keiran-recliner', '77176-windsor-loveseat'],
      vibe: 'cozy'
    },
    'modern-organic': {
      title: 'Modern Organic',
      blurb: 'Clean lines with natural materials — greige, stone, and quiet contrast.',
      styleIds: ['modern', 'transitional'],
      palette: ['#ececea', '#a8a8a4', '#8a9a8c', '#5a5a56'],
      productIds: ['77180-martina-sofa', '40112-essex-sofa'],
      vibe: 'modern'
    },
    'soft-coastal': {
      title: 'Soft Coastal',
      blurb: 'Sun-washed neutrals and easy sectionals — light, airy, and family-friendly.',
      styleIds: ['coastal', 'transitional'],
      palette: ['#f5f3ee', '#d8d2c8', '#8fa9b5', '#c9b896'],
      productIds: ['40112-essex-sofa', '40113-oxford-sofa'],
      vibe: 'relaxed'
    },
    'collected-traditional': {
      title: 'Collected Traditional',
      blurb: 'Rich leather, generous scale, and timeless silhouettes built to last.',
      styleIds: ['traditional'],
      palette: ['#f4efe6', '#8b5e3c', '#3d2a22', '#c4a574'],
      productIds: ['41067-washington-recliner', '77696-brookes-chair'],
      vibe: 'tailored'
    },
    'moody-luxe': {
      title: 'Moody Luxe',
      blurb: 'Deeper tones, power comfort, and dramatic media-room energy.',
      styleIds: ['contemporary', 'modern'],
      palette: ['#e8eaed', '#1e3a5f', '#4a4540', '#5c6b7a'],
      productIds: ['40109-reece-sofa', '77180-martina-sofa'],
      vibe: 'dramatic'
    }
  },

  visualQuiz: {
    title: 'Discover your McCabe style',
    questions: [
      {
        q: 'Which room feels most like you?',
        choices: [
          { label: 'Tailored family den', img: '/v/vspfiles/photos/Washington%2041067-1.jpg', scores: { traditional: 3, transitional: 1 }, vibe: 'cozy' },
          { label: 'Open modern great room', img: '/v/vspfiles/photos/77180-01-1.jpg', scores: { modern: 3, contemporary: 1 }, vibe: 'modern' },
          { label: 'Sunroom sectional', img: '/v/vspfiles/photos/Essex-SC-07-9W-08-1.jpg', scores: { coastal: 3, transitional: 1 }, vibe: 'relaxed' },
          { label: 'Media lounge', img: '/v/vspfiles/photos/40109-01-1.jpg', scores: { contemporary: 3 }, vibe: 'dramatic' }
        ]
      },
      {
        q: 'Which wood tone do you gravitate toward?',
        choices: [
          { label: 'Walnut & cognac', img: '/v/vspfiles/photos/77696-1.jpg', scores: { 'mid-century': 2, traditional: 2 }, vibe: 'cozy' },
          { label: 'Light oak', img: '/v/vspfiles/photos/40113-01-1.jpg', scores: { transitional: 2, coastal: 2 }, vibe: 'relaxed' },
          { label: 'Charcoal casegoods', img: '/v/vspfiles/photos/77180-01-1.jpg', scores: { modern: 3 }, vibe: 'modern' },
          { label: 'Painted millwork', img: '/v/vspfiles/photos/Keiran-SC-67-10-9X-10-66-1.jpg', scores: { transitional: 2, contemporary: 1 }, vibe: 'tailored' }
        ]
      },
      {
        q: 'Which color palette do you love most?',
        choices: [
          { label: 'Warm ivory & camel', img: '/v/vspfiles/photos/40113-01-1.jpg', scores: { transitional: 3, traditional: 1 }, vibe: 'cozy' },
          { label: 'Greige & stone', img: '/v/vspfiles/photos/77176-A1-1.jpg', scores: { modern: 2, transitional: 2 }, vibe: 'modern' },
          { label: 'Sand & sea glass', img: '/v/vspfiles/photos/Essex-SC-07-9W-08-1.jpg', scores: { coastal: 3 }, vibe: 'relaxed' },
          { label: 'Navy & brass', img: '/v/vspfiles/photos/40109-01-1.jpg', scores: { contemporary: 3, modern: 1 }, vibe: 'dramatic' }
        ]
      },
      {
        q: 'Which furniture silhouette do you prefer?',
        choices: [
          { label: 'Power reclining sofa', img: '/v/vspfiles/photos/Washington%2041067-1.jpg', scores: { traditional: 2, transitional: 2 }, vibe: 'cozy' },
          { label: 'Track-arm sofa', img: '/v/vspfiles/photos/77180-01-1.jpg', scores: { modern: 3 }, vibe: 'modern' },
          { label: 'Accent chair', img: '/v/vspfiles/photos/77696-1.jpg', scores: { 'mid-century': 3 }, vibe: 'tailored' },
          { label: 'Sectional', img: '/v/vspfiles/photos/Essex-SC-07-9W-08-1.jpg', scores: { coastal: 2, transitional: 2 }, vibe: 'relaxed' }
        ]
      },
      {
        q: 'Which vibe do you want most?',
        choices: [
          { label: 'Cozy', img: '/v/vspfiles/photos/Keiran-SC-67-10-9X-10-66-1.jpg', scores: { transitional: 2, traditional: 2 }, vibe: 'cozy' },
          { label: 'Tailored', img: '/v/vspfiles/photos/40113-01-1.jpg', scores: { transitional: 2, traditional: 1 }, vibe: 'tailored' },
          { label: 'Relaxed', img: '/v/vspfiles/photos/Essex-SC-07-9W-08-1.jpg', scores: { coastal: 3 }, vibe: 'relaxed' },
          { label: 'Dramatic', img: '/v/vspfiles/photos/40109-01-1.jpg', scores: { contemporary: 3 }, vibe: 'dramatic' }
        ]
      }
    ]
  },

  paletteLab: {
    presets: [
      {
        id: 'warm-neutral',
        label: 'Warm neutral',
        wall: '#f4efe6',
        sofa: 'Camel performance leather',
        rug: 'Oatmeal wool',
        wood: 'Honey oak',
        accent: '#9a6b42',
        paintPair: '#e8dfd0',
        styleIds: ['transitional', 'traditional'],
        productIds: ['40113-oxford-sofa', '41500-keiran-recliner']
      },
      {
        id: 'soft-coastal',
        label: 'Soft coastal',
        wall: '#f5f3ee',
        sofa: 'Sand linen-look fabric',
        rug: 'Bleached jute',
        wood: 'Whitewashed oak',
        accent: '#8fa9b5',
        paintPair: '#d8d2c8',
        styleIds: ['coastal'],
        productIds: ['40112-essex-sofa', '40113-oxford-sofa']
      },
      {
        id: 'earthy-organic',
        label: 'Earthy organic',
        wall: '#e8e4dc',
        sofa: 'Mushroom greige leather',
        rug: 'Charcoal flatweave',
        wood: 'Walnut',
        accent: '#6b4423',
        paintPair: '#c8bfb2',
        styleIds: ['modern', 'transitional'],
        productIds: ['77180-martina-sofa', '77696-brookes-chair']
      },
      {
        id: 'moody-dramatic',
        label: 'Moody dramatic',
        wall: '#3d4450',
        sofa: 'Deep navy leather',
        rug: 'Graphite wool',
        wood: 'Espresso',
        accent: '#b8956b',
        paintPair: '#1e3a5f',
        styleIds: ['contemporary', 'modern'],
        productIds: ['40109-reece-sofa', '77180-martina-sofa']
      },
      {
        id: 'classic-transitional',
        label: 'Classic transitional',
        wall: '#f0ebe4',
        sofa: 'Greige tailored upholstery',
        rug: 'Taupe sisal',
        wood: 'Medium walnut',
        accent: '#5c534c',
        paintPair: '#c8bfb2',
        styleIds: ['transitional'],
        productIds: ['77176-windsor-loveseat', '40113-oxford-sofa']
      }
    ]
  },

  editorialFeed: [
    {
      title: 'Warm minimalism is staying',
      excerpt: 'Layered neutrals and quiet contrast keep rooms calm without feeling cold.',
      source: 'Architectural Digest',
      sourceUrl: 'https://www.architecturaldigest.com/topic/neutral',
      mccabeTake: 'Pair Oxford or Keiran seating with ivory walls and walnut accents.',
      styleId: 'transitional',
      productIds: ['40113-oxford-sofa', '41500-keiran-recliner']
    },
    {
      title: 'Walnut & cognac are back',
      excerpt: 'Mid-century silhouettes and caramel leather anchor the room.',
      source: 'Elle Decor',
      sourceUrl: 'https://www.elledecor.com/design-decor/interior-designers/glimpse-inside-midcentury-modern-home',
      mccabeTake: 'Brookes accent chairs add MCM warmth without a full redesign.',
      styleId: 'mid-century',
      productIds: ['77696-brookes-chair']
    },
    {
      title: 'Media rooms go deep blue',
      excerpt: 'Navy upholstery and dimmable layers define theater lounges.',
      source: 'House Beautiful',
      sourceUrl: 'https://www.housebeautiful.com/room-decorating/theater-rooms/',
      mccabeTake: 'Reece power seating delivers performance fabric and recline for long screenings.',
      styleId: 'contemporary',
      productIds: ['40109-reece-sofa']
    },
    {
      title: 'Performance leather + power comfort',
      excerpt: 'Reclining sectionals with tailored stitching — comfort without bulk.',
      source: 'Better Homes & Gardens',
      sourceUrl: 'https://www.bhg.com/decorating/',
      mccabeTake: 'Washington and Keiran frames balance family durability with a tailored look.',
      styleId: 'traditional',
      productIds: ['41067-washington-recliner', '41500-keiran-recliner']
    },
    {
      title: 'Jewel-tone accents, edited',
      excerpt: 'One rich accent per room on a neutral field.',
      source: 'Veranda',
      sourceUrl: 'https://www.veranda.com/decorating-ideas/',
      mccabeTake: 'Use Martina or Reece in navy, then pull brass and terracotta in decor.',
      styleId: 'contemporary',
      productIds: ['77180-martina-sofa', '40109-reece-sofa']
    }
  ],

  decorTrends: [],

  styleQuiz: null,

  colorWheel: [],

  featuredTriptych: [
    '77696-brookes-chair',
    '77180-martina-sofa',
    '40112-essex-sofa'
  ],

  splitFeature: {
    productId: '40109-reece-sofa',
    styleId: 'contemporary',
    title: 'Reece power seating',
    text:
      'Performance upholstery and power comfort scaled for media rooms. Layer low lighting, a slim console, and tailored accents for a finished theater lounge.'
  },

  styles: [
    {
      id: 'traditional',
      label: 'Traditional',
      tagline: 'Tailored leather, generous scale',
      catalogSku: '41067',
      catalogPhoto: '/v/vspfiles/photos/Washington%2041067-1.jpg',
      heroProductId: '41067-washington-recliner',
      moodImage: '/v/vspfiles/boards/showcase/traditional-carob-recliner-front.png',
      palette: ['#f4f4f4', '#c4a574', '#6b3f2a', '#3d2a22', '#8b5e3c']
    },
    {
      id: 'transitional',
      label: 'Transitional',
      tagline: 'Soft neutrals, balanced profiles',
      catalogSku: '40113',
      catalogPhoto: '/v/vspfiles/photos/40113-01-1.jpg',
      heroProductId: '40113-oxford-sofa',
      moodImage: '/v/vspfiles/boards/showcase/transitional-london-fog-sofa-angle.png',
      palette: ['#f0f0f0', '#c8bfb2', '#9a8f82', '#5c534c', '#888888']
    },
    {
      id: 'modern',
      label: 'Modern',
      tagline: 'Track arms, edited lines',
      catalogSku: '77180',
      catalogPhoto: '/v/vspfiles/photos/77180-01-1.jpg',
      heroProductId: '77180-martina-sofa',
      moodImage: '/v/vspfiles/boards/showcase/modern-pacific-charcoal-sofa-angle.png',
      palette: ['#ececea', '#a8a8a4', '#5a5a56', '#2a2a28', '#7a8790']
    },
    {
      id: 'coastal',
      label: 'Coastal',
      tagline: 'Light sectionals, easy rhythm',
      catalogSku: '40112',
      catalogPhoto: '/v/vspfiles/photos/Essex-SC-07-9W-08-1.jpg',
      heroProductId: '40112-essex-sofa',
      moodImage: '/v/vspfiles/boards/showcase/transitional-london-fog-sofa-angle.png',
      palette: ['#f5f5f5', '#d8d2c8', '#8fa9b5', '#5c7a86', '#c9b896']
    },
    {
      id: 'mid-century',
      label: 'Mid-Century',
      tagline: 'Walnut frames, warm leather',
      catalogSku: '77696',
      catalogPhoto: '/v/vspfiles/photos/77696-1.jpg',
      heroProductId: '77696-brookes-chair',
      moodImage: '/v/vspfiles/boards/showcase/mid-century-lux-cognac-chair-angle.png',
      palette: ['#f0f0f0', '#c67b4e', '#6b4423', '#2f4f4f', '#d4a574']
    },
    {
      id: 'contemporary',
      label: 'Contemporary',
      tagline: 'Power comfort, bold upholstery',
      catalogSku: '40109',
      catalogPhoto: '/v/vspfiles/photos/40109-01-1.jpg',
      heroProductId: '40109-reece-sofa',
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

  /** McCabe catalog pieces — names/SKUs/photos verified against live search. */
  products: [
    {
      id: '77696-brookes-chair',
      sku: '77696',
      name: 'Brookes Stationary Chair',
      type: 'Accent chair',
      image: '/v/vspfiles/boards/showcase/mid-century-lux-cognac-chair-angle.png',
      catalogPhoto: '/v/vspfiles/photos/77696-1.jpg',
      shopUrl: '/product-p/brookes-sc-92-15.htm',
      styles: ['mid-century', 'transitional'],
      primaryStyle: 'mid-century'
    },
    {
      id: '77180-martina-sofa',
      sku: '77180',
      name: 'Martina Track Arm Sofa',
      type: 'Sofa',
      image: '/v/vspfiles/boards/showcase/modern-pacific-charcoal-sofa-angle.png',
      catalogPhoto: '/v/vspfiles/photos/77180-01-1.jpg',
      shopUrl: '/SearchResults.asp?Search=77180',
      styles: ['modern', 'contemporary'],
      primaryStyle: 'modern'
    },
    {
      id: '77176-windsor-loveseat',
      sku: '77176',
      name: 'Windsor Loveseat',
      type: 'Loveseat',
      image: '/v/vspfiles/boards/showcase/transitional-coachella-madeira-sofa-front.png',
      catalogPhoto: '/v/vspfiles/photos/77176-A1-1.jpg',
      shopUrl: '/SearchResults.asp?Search=77176',
      styles: ['transitional', 'traditional'],
      primaryStyle: 'transitional'
    },
    {
      id: '40109-reece-sofa',
      sku: '40109',
      name: 'Reece Sofa',
      type: 'Power reclining sofa',
      image: '/v/vspfiles/boards/showcase/contemporary-atlantic-navy-recliner-front.png',
      catalogPhoto: '/v/vspfiles/photos/40109-01-1.jpg',
      shopUrl: '/SearchResults.asp?Search=40109',
      styles: ['contemporary', 'modern'],
      primaryStyle: 'contemporary'
    },
    {
      id: '40112-essex-sofa',
      sku: '40112',
      name: 'Essex Sofa',
      type: 'Sectional sofa',
      image: '/v/vspfiles/boards/showcase/transitional-london-fog-sofa-angle.png',
      catalogPhoto: '/v/vspfiles/photos/Essex-SC-07-9W-08-1.jpg',
      shopUrl: '/product-p/essex-sc-07-9w-08.htm',
      styles: ['coastal', 'transitional'],
      primaryStyle: 'coastal'
    },
    {
      id: '40113-oxford-sofa',
      sku: '40113',
      name: 'Oxford Sofa',
      type: 'Sofa',
      image: '/v/vspfiles/boards/showcase/transitional-london-fog-sofa-angle.png',
      catalogPhoto: '/v/vspfiles/photos/40113-01-1.jpg',
      shopUrl: '/product-p/40113-01.htm',
      styles: ['transitional', 'coastal'],
      primaryStyle: 'transitional'
    },
    {
      id: '41067-washington-recliner',
      sku: '41067',
      name: 'Palliser Washington Power Reclining Sofa',
      type: 'Power reclining sofa',
      image: '/v/vspfiles/boards/showcase/traditional-carob-recliner-front.png',
      catalogPhoto: '/v/vspfiles/photos/Washington%2041067-1.jpg',
      shopUrl: '/SearchResults.asp?Search=41067',
      styles: ['traditional'],
      primaryStyle: 'traditional'
    },
    {
      id: '41500-keiran-recliner',
      sku: '41500',
      name: 'Palliser Keiran Power Reclining Sofa',
      type: 'Power reclining sofa',
      image: '/v/vspfiles/boards/showcase/transitional-cognac-recliner-front.png',
      catalogPhoto: '/v/vspfiles/photos/Keiran-SC-67-10-9X-10-66-1.jpg',
      shopUrl: '/product-p/keiran-sc-67-10-9x-10-66.htm',
      styles: ['transitional', 'traditional'],
      primaryStyle: 'transitional'
    }
  ],

  /**
   * Lifestyle scenes: CSS room wash + product cutout (design-board presentation).
   */
  lifestyleLooks: [
    {
      id: 'mcm-brookes-lounge',
      styleId: 'mid-century',
      title: 'Brookes Accent Chair — Living Room',
      room: 'Living room',
      mood: 'tailored',
      sceneClass: 'mc-scene--mcm',
      productId: '77696-brookes-chair',
      image: '/v/vspfiles/boards/showcase/mid-century-lux-cognac-chair-angle.png',
      accents: ['#f0e6d8', '#c67b4e', '#2f4f4f', '#6b4423']
    },
    {
      id: 'modern-martina-loft',
      styleId: 'modern',
      title: 'Martina Track Arm Sofa — Great Room',
      room: 'Great room',
      mood: 'modern',
      sceneClass: 'mc-scene--modern',
      productId: '77180-martina-sofa',
      image: '/v/vspfiles/boards/showcase/modern-pacific-charcoal-sofa-angle.png',
      accents: ['#ececea', '#7a8790', '#2a2a28', '#a8a8a4']
    },
    {
      id: 'contemporary-reece-media',
      styleId: 'contemporary',
      title: 'Reece Sofa — Home Theater',
      room: 'Home theater',
      mood: 'dramatic',
      sceneClass: 'mc-scene--contemporary',
      productId: '40109-reece-sofa',
      image: '/v/vspfiles/boards/showcase/contemporary-atlantic-navy-recliner-angle.png',
      accents: ['#e8eaed', '#1e3a5f', '#5c6b7a', '#b8956b']
    },
    {
      id: 'traditional-washington-den',
      styleId: 'traditional',
      title: 'Washington Power Reclining Sofa — Family Room',
      room: 'Family room',
      mood: 'cozy',
      sceneClass: 'mc-scene--traditional',
      productId: '41067-washington-recliner',
      image: '/v/vspfiles/boards/showcase/traditional-carob-recliner-recline.png',
      accents: ['#f4efe6', '#8b5e3c', '#3d2a22', '#c4a574']
    },
    {
      id: 'transitional-keiran-family',
      styleId: 'transitional',
      title: 'Keiran Power Reclining Sofa — Living Room',
      room: 'Living room',
      mood: 'cozy',
      sceneClass: 'mc-scene--transitional',
      productId: '41500-keiran-recliner',
      image: '/v/vspfiles/boards/showcase/transitional-cognac-recliner-angle.png',
      accents: ['#f0ebe4', '#b8956b', '#5c534c', '#9a6b42']
    },
    {
      id: 'coastal-essex-sunroom',
      styleId: 'coastal',
      title: 'Essex Sofa — Sunroom',
      room: 'Sunroom',
      mood: 'relaxed',
      sceneClass: 'mc-scene--coastal',
      productId: '40112-essex-sofa',
      image: '/v/vspfiles/photos/Essex-SC-07-9W-08-1.jpg',
      accents: ['#f5f3ee', '#8fa9b5', '#d8d2c8', '#c9b896']
    },
    {
      id: 'transitional-oxford-study',
      styleId: 'transitional',
      title: 'Oxford Sofa — Study',
      room: 'Study',
      mood: 'tailored',
      sceneClass: 'mc-scene--transitional-warm',
      productId: '40113-oxford-sofa',
      image: '/v/vspfiles/photos/40113-01-1.jpg',
      accents: ['#efe9e0', '#6b3f2a', '#4a4540', '#c4a574']
    },
    {
      id: 'transitional-windsor-nook',
      styleId: 'transitional',
      title: 'Windsor Loveseat — Reading Nook',
      room: 'Reading nook',
      mood: 'relaxed',
      sceneClass: 'mc-scene--modern-soft',
      productId: '77176-windsor-loveseat',
      image: '/v/vspfiles/photos/77176-A1-1.jpg',
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
    brookes: 'mid-century',
    martina: 'modern',
    essex: 'coastal',
    oxford: 'transitional',
    reece: 'contemporary',
    keiran: 'transitional',
    washington: 'traditional',
    windsor: 'transitional'
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
    if (style.catalogPhoto) return style.catalogPhoto;
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
      if (tp.type) {
        var ttype = document.createElement('p');
        ttype.className = 'mc-boards__triptych-meta';
        ttype.textContent = tp.type;
        tbtn.appendChild(ttype);
      }
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

  var life = document.getElementById('mc-boards-lifestyle-grid') || document.getElementById('mc-boards-lifestyle');
  if (life && !life.children.length && C.lifestyleLooks) {
    for (var l = 0; l < C.lifestyleLooks.length; l++) {
      var look = C.lifestyleLooks[l];
      var prodL = productById(look.productId);
      var art = document.createElement('article');
      art.className = 'mc-boards__lifestyle-card';
      art.setAttribute('role', 'listitem');
      var limSrc = look.image || (prodL ? imgSrc(prodL) : '');
      if (limSrc) {
        var lw = document.createElement('div');
        lw.className = 'mc-boards__lifestyle-img';
        var lim = document.createElement('img');
        lim.src = limSrc;
        lim.alt = look.title || (prodL ? prodL.name : '');
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
  var trendList = C.editorialFeed || C.decorTrends || [];
  if (trends && !trends.children.length && trendList.length) {
    for (var d = 0; d < trendList.length; d++) {
      var tr = trendList[d];
      var tstyle = styleById(tr.styleId);
      var tcard = document.createElement('article');
      tcard.className = 'mc-boards__trend-card';
      if (tstyle && styleImg(tstyle)) {
        var tv = document.createElement('div');
        tv.className = 'mc-boards__trend-visual';
        var ti = document.createElement('img');
        ti.src = styleImg(tstyle);
        ti.alt = '';
        ti.loading = 'lazy';
        tv.appendChild(ti);
        tcard.appendChild(tv);
      }
      var th = document.createElement('h3');
      th.className = 'mc-boards__trend-title';
      th.textContent = tr.title;
      tcard.appendChild(th);
      var tb = document.createElement('p');
      tb.className = 'mc-boards__trend-blurb';
      tb.textContent = tr.excerpt || tr.blurb || '';
      tcard.appendChild(tb);
      if (tr.mccabeTake) {
        var tk = document.createElement('p');
        tk.className = 'mc-boards__mccabe-take';
        tk.textContent = 'How we\'d style it: ' + tr.mccabeTake;
        tcard.appendChild(tk);
      }
      trends.appendChild(tcard);
    }
  }

  var quizRoot = document.getElementById('mc-boards-quiz-app');
  if (quizRoot && !quizRoot.children.length && C.visualQuiz && C.visualQuiz.questions) {
    var q0 = C.visualQuiz.questions[0];
    var qp = document.createElement('p');
    qp.className = 'mc-boards__quiz-q';
    qp.textContent = q0.q;
    quizRoot.appendChild(qp);
    var qg = document.createElement('div');
    qg.className = 'mc-boards__quiz-visual-grid';
    for (var qi = 0; qi < q0.choices.length; qi++) {
      var qc = q0.choices[qi];
      var qbtn = document.createElement('div');
      qbtn.className = 'mc-boards__quiz-visual-card';
      var qw = document.createElement('div');
      qw.className = 'mc-boards__quiz-visual-img';
      var qim = document.createElement('img');
      qim.src = qc.img;
      qim.alt = qc.label;
      qw.appendChild(qim);
      qbtn.appendChild(qw);
      var ql = document.createElement('span');
      ql.className = 'mc-boards__quiz-visual-label';
      ql.textContent = qc.label;
      qbtn.appendChild(ql);
      qg.appendChild(qbtn);
    }
    quizRoot.appendChild(qg);
  }

  var palApp = document.getElementById('mc-boards-palette-app');
  if (palApp && !palApp.children.length && C.paletteLab && C.paletteLab.presets) {
    var pr = document.createElement('div');
    pr.className = 'mc-boards__palette-presets';
    for (var pi = 0; pi < C.paletteLab.presets.length; pi++) {
      var chip = document.createElement('span');
      chip.className = 'mc-boards__filter-chip';
      chip.textContent = C.paletteLab.presets[pi].label;
      pr.appendChild(chip);
    }
    palApp.appendChild(pr);
    var disc = document.createElement('div');
    disc.className = 'mc-boards__wheel-disc';
    disc.setAttribute('aria-hidden', 'true');
    palApp.appendChild(disc);
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
    s.src = '/v/vspfiles/boards/my-boards-page.js?v=20260540';
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
