/**
 * Style + furniture-type library for inspiration boards UI.
 * Replace moodImage paths with your own JPG/WebP in /v/vspfiles/boards/mood/
 */
window.MC_BOARD_STYLES = {
  styles: [
    {
      id: 'traditional',
      label: 'Traditional',
      tagline: 'Tailored silhouettes, rich woods, timeless comfort',
      moodImage: '/v/vspfiles/boards/mood/traditional.svg',
      palette: ['#f4efe6', '#c4a574', '#8b5e3c', '#3d3229', '#6b4f3a']
    },
    {
      id: 'transitional',
      label: 'Transitional',
      tagline: 'Soft neutrals with quiet contrast and balance',
      moodImage: '/v/vspfiles/boards/mood/transitional.svg',
      palette: ['#ece8e1', '#b8aea0', '#7d7468', '#4a4540', '#9a8f7a']
    },
    {
      id: 'modern',
      label: 'Modern',
      tagline: 'Clean lines, sculptural forms, edited palettes',
      moodImage: '/v/vspfiles/boards/mood/modern.svg',
      palette: ['#f2f2f0', '#c8c8c4', '#6e6e6a', '#2a2a28', '#8a8a86']
    },
    {
      id: 'coastal',
      label: 'Coastal',
      tagline: 'Airy linen, sun-washed blues, relaxed luxury',
      moodImage: '/v/vspfiles/boards/mood/coastal.svg',
      palette: ['#f5f3ee', '#d4cfc4', '#8fa9b5', '#5c7a86', '#c9b896']
    },
    {
      id: 'mid-century',
      label: 'Mid-Century',
      tagline: 'Walnut warmth, graphic curves, vintage spirit',
      moodImage: '/v/vspfiles/boards/mood/mid-century.svg',
      palette: ['#f0e6d8', '#c67b4e', '#8b4518', '#2f4f4f', '#d4a574']
    },
    {
      id: 'contemporary',
      label: 'Contemporary',
      tagline: 'Layered texture, stone tones, gallery calm',
      moodImage: '/v/vspfiles/boards/mood/contemporary.svg',
      palette: ['#ebe9e4', '#a39e94', '#5c5852', '#1f1e1c', '#b8956b']
    }
  ],
  furnitureTypes: [
    { id: 'seating', label: 'Seating', desc: 'Sofas & sectionals' },
    { id: 'media', label: 'Media rooms', desc: 'Theater & entertainment' },
    { id: 'dining', label: 'Dining', desc: 'Tables & chairs' },
    { id: 'bedroom', label: 'Bedroom', desc: 'Beds & casegoods' },
    { id: 'accent', label: 'Accents', desc: 'Chairs, ottomans, decor' }
  ],
  boardStyleHints: {
    inspiration: 'transitional',
    traditional: 'traditional',
    modern: 'modern',
    coastal: 'coastal',
    'mid-century': 'mid-century',
    'mid century': 'mid-century',
    contemporary: 'contemporary',
    living: 'transitional',
    family: 'transitional',
    theater: 'contemporary',
    media: 'contemporary',
    dining: 'traditional',
    bedroom: 'coastal'
  }
};
