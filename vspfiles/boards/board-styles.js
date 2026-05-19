/**
 * Style library + curated McCabe product looks for inspiration boards.
 * Product PNGs: /v/vspfiles/boards/showcase/
 */
window.MC_BOARD_STYLES = {
  styles: [
    {
      id: 'traditional',
      label: 'Traditional',
      tagline: 'Rich leather, generous comfort, timeless scale',
      moodImage: '/v/vspfiles/boards/showcase/traditional-carob-recliner-front.png',
      palette: ['#f4efe6', '#c4a574', '#6b3f2a', '#3d2a22', '#8b5e3c']
    },
    {
      id: 'transitional',
      label: 'Transitional',
      tagline: 'Neutral leathers, balanced lines, everyday luxury',
      moodImage: '/v/vspfiles/boards/showcase/transitional-london-fog-sofa-angle.png',
      palette: ['#f0ebe4', '#c8bfb2', '#9a8f82', '#5c534c', '#b8956b']
    },
    {
      id: 'modern',
      label: 'Modern',
      tagline: 'Track arms, edited silhouettes, cool contrast',
      moodImage: '/v/vspfiles/boards/showcase/modern-pacific-charcoal-sofa-angle.png',
      palette: ['#ececea', '#a8a8a4', '#5a5a56', '#2a2a28', '#7a8790']
    },
    {
      id: 'coastal',
      label: 'Coastal',
      tagline: 'Sun-washed neutrals, relaxed linen mood',
      moodImage: '/v/vspfiles/boards/showcase/transitional-london-fog-sofa-angle.png',
      palette: ['#f5f3ee', '#d8d2c8', '#8fa9b5', '#5c7a86', '#c9b896']
    },
    {
      id: 'mid-century',
      label: 'Mid-Century',
      tagline: 'Walnut frame, cognac leather, low profile',
      moodImage: '/v/vspfiles/boards/showcase/mid-century-lux-cognac-chair-angle.png',
      palette: ['#f0e6d8', '#c67b4e', '#6b4423', '#2f4f4f', '#d4a574']
    },
    {
      id: 'contemporary',
      label: 'Contemporary',
      tagline: 'Bold color, power comfort, gallery calm',
      moodImage: '/v/vspfiles/boards/showcase/contemporary-atlantic-navy-recliner-front.png',
      palette: ['#e8eaed', '#5c6b7a', '#1e3a5f', '#152238', '#b8956b']
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
      styles: ['mid-century', 'transitional', 'modern'],
      primaryStyle: 'mid-century'
    },
    {
      id: '77180-pacific-sofa',
      name: 'Pacific Charcoal Sofa',
      type: 'Sofa',
      image: '/v/vspfiles/boards/showcase/modern-pacific-charcoal-sofa-angle.png',
      styles: ['modern', 'contemporary', 'transitional'],
      primaryStyle: 'modern'
    },
    {
      id: '77180-pacific-loveseat',
      name: 'Pacific Charcoal Loveseat',
      type: 'Loveseat',
      image: '/v/vspfiles/boards/showcase/modern-pacific-charcoal-loveseat-angle.png',
      styles: ['modern', 'contemporary', 'transitional'],
      primaryStyle: 'modern'
    },
    {
      id: '40109-atlantic-navy',
      name: 'Atlantic Navy Power Sofa',
      type: 'Power reclining sofa',
      image: '/v/vspfiles/boards/showcase/contemporary-atlantic-navy-recliner-front.png',
      styles: ['contemporary', 'modern'],
      primaryStyle: 'contemporary'
    },
    {
      id: '41067-carob-recliner',
      name: 'Carob Power Reclining Sofa',
      type: 'Power reclining sofa',
      image: '/v/vspfiles/boards/showcase/traditional-carob-recliner-front.png',
      styles: ['traditional', 'transitional'],
      primaryStyle: 'traditional'
    },
    {
      id: '41500-cognac-recliner',
      name: 'Cognac Power Reclining Sofa',
      type: 'Power reclining sofa',
      image: '/v/vspfiles/boards/showcase/transitional-cognac-recliner-front.png',
      styles: ['transitional', 'traditional'],
      primaryStyle: 'transitional'
    },
    {
      id: '77176-coachella-madeira',
      name: 'Coachella Madeira Sofa',
      type: 'Sofa',
      image: '/v/vspfiles/boards/showcase/transitional-coachella-madeira-sofa-front.png',
      styles: ['transitional', 'modern', 'traditional'],
      primaryStyle: 'transitional'
    },
    {
      id: '40113-london-fog',
      name: 'London Fog Power Sofa',
      type: 'Power reclining sofa',
      image: '/v/vspfiles/boards/showcase/transitional-london-fog-sofa-angle.png',
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
