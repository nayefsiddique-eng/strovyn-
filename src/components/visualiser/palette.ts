export interface IllustrativePaletteSwatch {
  id: string;
  name: string;
  category: 'Architectural Mineral' | 'Warm Editorial' | 'Artisanal Limewash';
  hex: string;
  lrv: number;
  sheenLabel: string;
  recommendedSubstrate: string;
  lightingBehavior: string;
  isIllustrative: true;
}

/**
 * Illustrative Strovyn Architectural Palette.
 * Not tied to third-party paint manufacturer codes.
 */
export const ILLUSTRATIVE_PALETTE: IllustrativePaletteSwatch[] = [
  {
    id: 'warm-ivory-mineral',
    name: 'Warm Ivory Mineral',
    category: 'Architectural Mineral',
    hex: '#F4F1EA',
    lrv: 86,
    sheenLabel: 'Deep Velvet Matte (3%)',
    recommendedSubstrate: 'Ceilings & Double-Height Living Pavilions',
    lightingBehavior: 'Diffuses raking low-angle daylight softly without planar glare or flashing.',
    isIllustrative: true,
  },
  {
    id: 'raw-limestone-chalk',
    name: 'Raw Limestone Chalk',
    category: 'Artisanal Limewash',
    hex: '#EBE7DF',
    lrv: 79,
    sheenLabel: 'Dead Flat (1%)',
    recommendedSubstrate: 'Internal Masonry, Bluestone & Sandstone Accents',
    lightingBehavior: 'Absorbs ambient light naturally, offering subtle chalky micro-mottling.',
    isIllustrative: true,
  },
  {
    id: 'soft-linen-mist',
    name: 'Soft Linen Mist',
    category: 'Architectural Mineral',
    hex: '#DFD9CE',
    lrv: 69,
    sheenLabel: 'Low-Sheen Matte (5%)',
    recommendedSubstrate: 'Open-Plan Living Walls & Gallery Corridors',
    lightingBehavior: 'Maintains neutral warmth across north- and south-facing rooms.',
    isIllustrative: true,
  },
  {
    id: 'warm-travertine',
    name: 'Warm Travertine',
    category: 'Warm Editorial',
    hex: '#CFC4B4',
    lrv: 56,
    sheenLabel: 'Velvet Low-Sheen (6%)',
    recommendedSubstrate: 'Bedroom Suites & Warm Timber-Adjoining Walls',
    lightingBehavior: 'Balances natural oak and stone surfaces without yellow cast.',
    isIllustrative: true,
  },
  {
    id: 'muted-bronze-ochre',
    name: 'Muted Bronze Ochre',
    category: 'Warm Editorial',
    hex: '#A78B65',
    lrv: 31,
    sheenLabel: 'Low-Sheen Eggshell (8%)',
    recommendedSubstrate: 'Dining Alcoves, Study Joinery & Feature Niches',
    lightingBehavior: 'Develops deep, intimate warmth under evening 2700K illumination.',
    isIllustrative: true,
  },
  {
    id: 'eucalyptus-shadow',
    name: 'Eucalyptus Shadow',
    category: 'Artisanal Limewash',
    hex: '#5D665B',
    lrv: 14,
    sheenLabel: 'Mineral Matte (4%)',
    recommendedSubstrate: 'Studies, Libraries & Garden-Facing Rooms',
    lightingBehavior: 'Grounds bright Adelaide daylight with muted organic depth.',
    isIllustrative: true,
  },
  {
    id: 'adelaide-hills-slate',
    name: 'Adelaide Hills Slate',
    category: 'Warm Editorial',
    hex: '#7A7D79',
    lrv: 21,
    sheenLabel: 'Velvet Low-Sheen (6%)',
    recommendedSubstrate: 'Master Suites & Feature Wall Transitions',
    lightingBehavior: 'Subtly shifts between warm olive and cool slate across the diurnal cycle.',
    isIllustrative: true,
  },
  {
    id: 'deep-architectural-charcoal',
    name: 'Deep Architectural Charcoal',
    category: 'Architectural Mineral',
    hex: '#20211F',
    lrv: 4,
    sheenLabel: 'Satin Finish (20%)',
    recommendedSubstrate: 'Architectural Millwork, Doors & Window Reveals',
    lightingBehavior: 'Provides grounding contrast against pale timber and raw natural stone.',
    isIllustrative: true,
  },
];
