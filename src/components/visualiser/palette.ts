export type PaletteFamily =
  | 'Warm Whites'
  | 'Cool Whites'
  | 'Creams & Ivories'
  | 'Beige & Sand'
  | 'Greige & Taupe'
  | 'Warm Neutrals'
  | 'Cool Greys'
  | 'Charcoals'
  | 'Terracotta & Clay'
  | 'Earthy Reds'
  | 'Sage & Olive Greens'
  | 'Forest Greens'
  | 'Muted Blues'
  | 'Deep Navy';

export const PALETTE_FAMILIES: PaletteFamily[] = [
  'Warm Whites',
  'Cool Whites',
  'Creams & Ivories',
  'Beige & Sand',
  'Greige & Taupe',
  'Warm Neutrals',
  'Cool Greys',
  'Charcoals',
  'Terracotta & Clay',
  'Earthy Reds',
  'Sage & Olive Greens',
  'Forest Greens',
  'Muted Blues',
  'Deep Navy',
];

export type PaintFinishId = 'matte' | 'eggshell' | 'satin' | 'semi-gloss' | 'gloss';

export interface PaintFinishSpec {
  id: PaintFinishId;
  label: string;
  sheenRange: string;
  specBoost: number;
  summary: string;
}

export const PAINT_FINISHES: PaintFinishSpec[] = [
  {
    id: 'matte',
    label: 'Matte',
    sheenRange: '2–5% sheen',
    specBoost: 0.0,
    summary: 'Non-reflective architectural finish that conceals minor plaster imperfections under raking light.',
  },
  {
    id: 'eggshell',
    label: 'Eggshell',
    sheenRange: '7–12% sheen',
    specBoost: 0.035,
    summary: 'Soft velvet lustre balancing cleanability with understated depth in living areas.',
  },
  {
    id: 'satin',
    label: 'Satin',
    sheenRange: '15–25% sheen',
    specBoost: 0.075,
    summary: 'Gentle pearl sheen suited to high-traffic hallways, kitchens, and family rooms.',
  },
  {
    id: 'semi-gloss',
    label: 'Semi-Gloss',
    sheenRange: '35–50% sheen',
    specBoost: 0.125,
    summary: 'Crisp, wipeable enamel finish ideal for doors, architraves, skirtings, and wet zones.',
  },
  {
    id: 'gloss',
    label: 'Gloss',
    sheenRange: '65–80% sheen',
    specBoost: 0.18,
    summary: 'High-clarity reflective lacquer for bespoke joinery, feature doors, and heritage trim.',
  },
];

export interface IllustrativePaletteSwatch {
  id: string;
  name: string;
  family: PaletteFamily;
  category: 'Architectural Mineral' | 'Warm Editorial' | 'Artisanal Limewash';
  hex: string;
  lrv: number;
  tone: 'light' | 'mid' | 'dark';
  sheenLabel: string;
  recommendedSubstrate: string;
  lightingBehavior: string;
  isIllustrative: true;
}

type SwatchSeed = [
  id: string,
  name: string,
  family: PaletteFamily,
  hex: string,
  lrv: number,
  category?: IllustrativePaletteSwatch['category'],
];

const FAMILY_GUIDANCE: Record<PaletteFamily, { substrate: string; lighting: string }> = {
  'Warm Whites': {
    substrate: 'Level 5 plastered walls, ceilings, and heritage cornices',
    lighting: 'Softens harsh Australian afternoon glare while preserving warm timber undertones.',
  },
  'Cool Whites': {
    substrate: 'Contemporary gallery walls, crisp shadowlines, and north-facing rooms',
    lighting: 'Maintains a clean, gallery-grade architectural edge in bright natural light.',
  },
  'Creams & Ivories': {
    substrate: 'Double-height living pavilions, heritage villas, and plasterwork',
    lighting: 'Diffuses low-angle morning and evening light without yellowing excessively.',
  },
  'Beige & Sand': {
    substrate: 'Bedrooms, limestone-adjoining interiors, and coastal residences',
    lighting: 'Harmonises with natural travertine, oak flooring, and linen drapery.',
  },
  'Greige & Taupe': {
    substrate: 'Open-plan living areas, hallways, and architectural joinery',
    lighting: 'Bridges warm stone and cool steel window frames across changing daylight.',
  },
  'Warm Neutrals': {
    substrate: 'Studies, dining rooms, and textured limewash feature walls',
    lighting: 'Deepens in evening 2700K artificial light without losing surface clarity.',
  },
  'Cool Greys': {
    substrate: 'Modernist interiors, concrete-paired walls, and commercial suites',
    lighting: 'Offers composed tonal restraint in sunlit spaces.',
  },
  Charcoals: {
    substrate: 'Media rooms, library joinery, and architectural accent facades',
    lighting: 'Anchors bright rooms with dramatic contrast; best evaluated with large drawdown samples.',
  },
  'Terracotta & Clay': {
    substrate: 'Dining alcoves, courtyard walls, and masonry feature zones',
    lighting: 'Brings Mediterranean warmth to south-facing and shaded interiors.',
  },
  'Earthy Reds': {
    substrate: 'Period dining rooms, entry foyers, and bespoke cabinetry',
    lighting: 'Produces rich, heritage depth under both natural and warm artificial light.',
  },
  'Sage & Olive Greens': {
    substrate: 'Garden-facing rooms, studies, and timber-framed bedrooms',
    lighting: 'Connects interior plaster planes softly to Adelaide Hills foliage.',
  },
  'Forest Greens': {
    substrate: 'Libraries, bespoke kitchen islands, and formal sitting rooms',
    lighting: 'Reads moody and architectural in low light while revealing green nuance in daylight.',
  },
  'Muted Blues': {
    substrate: 'Coastal bedrooms, bathrooms, and sunlit sitting rooms',
    lighting: 'Balances bright coastal reflection with calm mineral coolness.',
  },
  'Deep Navy': {
    substrate: 'Bespoke cabinetry, formal studies, and architectural door accents',
    lighting: 'Retains crisp depth in daylight and transitions toward midnight ink at night.',
  },
};

const RAW_SWATCHES: SwatchSeed[] = [
  // Preserved Core Swatches (compatible with FinishExplorer ?finish= links)
  ['warm-ivory-mineral', 'Warm Ivory Mineral', 'Creams & Ivories', '#F4F1EA', 86, 'Architectural Mineral'],
  ['raw-limestone-chalk', 'Raw Limestone Chalk', 'Creams & Ivories', '#EBE7DF', 79, 'Artisanal Limewash'],
  ['soft-linen-mist', 'Soft Linen Mist', 'Beige & Sand', '#DFD9CE', 69, 'Architectural Mineral'],
  ['warm-travertine', 'Warm Travertine', 'Beige & Sand', '#CFC4B4', 56, 'Warm Editorial'],
  ['muted-bronze-ochre', 'Muted Bronze Ochre', 'Warm Neutrals', '#A78B65', 31, 'Warm Editorial'],
  ['eucalyptus-shadow', 'Eucalyptus Shadow', 'Sage & Olive Greens', '#5D665B', 14, 'Artisanal Limewash'],
  ['adelaide-hills-slate', 'Adelaide Hills Slate', 'Cool Greys', '#7A7D79', 21, 'Warm Editorial'],
  ['deep-architectural-charcoal', 'Deep Architectural Charcoal', 'Charcoals', '#20211F', 4, 'Architectural Mineral'],

  // Warm Whites
  ['alabaster-plaster', 'Alabaster Plaster', 'Warm Whites', '#F8F6F1', 91],
  ['parchment-white', 'Parchment White', 'Warm Whites', '#F5F2EA', 88],
  ['cotton-chalk', 'Cotton Chalk', 'Warm Whites', '#F3EFE6', 85],
  ['saltbush-white', 'Saltbush White', 'Warm Whites', '#EFECE3', 82],
  ['calcium-wash', 'Calcium Wash', 'Warm Whites', '#F7F4ED', 89],

  // Cool Whites
  ['gallery-white', 'Gallery White', 'Cool Whites', '#F4F5F6', 90],
  ['ice-gypsum', 'Ice Gypsum', 'Cool Whites', '#EFF2F3', 87],
  ['mineral-snow', 'Mineral Snow', 'Cool Whites', '#E9ECEE', 83],
  ['architect-white', 'Architect White', 'Cool Whites', '#F1F2F0', 88],
  ['nordic-lime', 'Nordic Lime', 'Cool Whites', '#E6E9EA', 80],

  // Creams & Ivories
  ['antique-putty', 'Antique Putty', 'Creams & Ivories', '#EAE3D5', 77],
  ['villas-cream', 'Villa Cream', 'Creams & Ivories', '#E8DFCE', 74],
  ['oatmeal-veil', 'Oatmeal Veil', 'Creams & Ivories', '#E3DAC9', 70],

  // Beige & Sand
  ['somerton-sand', 'Somerton Sand', 'Beige & Sand', '#D7CCB9', 61],
  ['glenelg-dune', 'Glenelg Dune', 'Beige & Sand', '#CCC0AC', 54],
  ['wheat-stucco', 'Wheat Stucco', 'Beige & Sand', '#C5B7A1', 49],
  ['toasted-calcite', 'Toasted Calcite', 'Beige & Sand', '#BAA991', 42],

  // Greige & Taupe
  ['stone-greige', 'Stone Greige', 'Greige & Taupe', '#CCC6BC', 57],
  ['warm-pewter', 'Warm Pewter', 'Greige & Taupe', '#B8B1A7', 46],
  ['norwood-taupe', 'Norwood Taupe', 'Greige & Taupe', '#A49B90', 36],
  ['timber-taupe', 'Timber Taupe', 'Greige & Taupe', '#8F8579', 26],
  ['umber-greige', 'Umber Greige', 'Greige & Taupe', '#786F65', 18],

  // Warm Neutrals
  ['raw-sienna-wash', 'Raw Sienna Wash', 'Warm Neutrals', '#B99F7D', 38],
  ['aged-brass', 'Aged Brass', 'Warm Neutrals', '#967C58', 24],
  ['smoked-walnut', 'Smoked Walnut', 'Warm Neutrals', '#6E5A45', 13],
  ['earth-mortar', 'Earth Mortar', 'Warm Neutrals', '#867663', 21],

  // Cool Greys
  ['silver-quartz', 'Silver Quartz', 'Cool Greys', '#D5D8D9', 68],
  ['mist-concrete', 'Mist Concrete', 'Cool Greys', '#BEC3C5', 54],
  ['ash-shale', 'Ash Shale', 'Cool Greys', '#9EA4A7', 37],
  ['harbour-fog', 'Harbour Fog', 'Cool Greys', '#878E92', 27],
  ['storm-basalt', 'Storm Basalt', 'Cool Greys', '#62686C', 14],

  // Charcoals
  ['graphite-render', 'Graphite Render', 'Charcoals', '#4D504E', 9],
  ['ironbark-charcoal', 'Ironbark Charcoal', 'Charcoals', '#3B3D3B', 6],
  ['obsidian-slate', 'Obsidian Slate', 'Charcoals', '#2B2D2C', 4],
  ['carbon-lacquer', 'Carbon Lacquer', 'Charcoals', '#181918', 2],

  // Terracotta & Clay
  ['adelaide-clay', 'Adelaide Clay', 'Terracotta & Clay', '#C88D74', 34],
  ['baked-terracotta', 'Baked Terracotta', 'Terracotta & Clay', '#B46F55', 22],
  ['kiln-ochre', 'Kiln Ochre', 'Terracotta & Clay', '#C47E5A', 28],
  ['sunbaked-render', 'Sunbaked Render', 'Terracotta & Clay', '#A85F47', 17],
  ['desert-earth', 'Desert Earth', 'Terracotta & Clay', '#8F4D39', 12],

  // Earthy Reds
  ['heritage-oxide', 'Heritage Oxide', 'Earthy Reds', '#8E3E36', 10],
  ['venetian-brick', 'Venetian Brick', 'Earthy Reds', '#7C322D', 8],
  ['claret-plaster', 'Claret Plaster', 'Earthy Reds', '#682A2A', 6],
  ['rust-umber', 'Rust Umber', 'Earthy Reds', '#9A4B3E', 13],
  ['rosewood-wash', 'Rosewood Wash', 'Earthy Reds', '#A35C52', 16],

  // Sage & Olive Greens
  ['pale-sage', 'Pale Sage', 'Sage & Olive Greens', '#C3CABD', 57],
  ['salvia-mist', 'Salvia Mist', 'Sage & Olive Greens', '#A6B19E', 43],
  ['hillside-olive', 'Hillside Olive', 'Sage & Olive Greens', '#87937E', 28],
  ['lichen-green', 'Lichen Green', 'Sage & Olive Greens', '#75826D', 22],
  ['moss-stone', 'Moss Stone', 'Sage & Olive Greens', '#66715E', 17],

  // Forest Greens
  ['cypress-bough', 'Cypress Bough', 'Forest Greens', '#485947', 10],
  ['botanic-pine', 'Botanic Pine', 'Forest Greens', '#364738', 6],
  ['deep-mallee', 'Deep Mallee', 'Forest Greens', '#29392C', 4],
  ['verdigris-shade', 'Verdigris Shade', 'Forest Greens', '#3D524A', 8],
  ['juniper-dark', 'Juniper Dark', 'Forest Greens', '#223027', 3],

  // Muted Blues
  ['chalky-sky', 'Chalky Sky', 'Muted Blues', '#C5D0D6', 62],
  ['coastal-slate-blue', 'Coastal Slate Blue', 'Muted Blues', '#9EB0BA', 42],
  ['gulf-mist', 'Gulf Mist', 'Muted Blues', '#7E93A0', 29],
  ['muted-denim', 'Muted Denim', 'Muted Blues', '#5E7484', 17],
  ['mineral-cobalt', 'Mineral Cobalt', 'Muted Blues', '#4B6172', 12],

  // Deep Navy
  ['indigo-plaster', 'Indigo Plaster', 'Deep Navy', '#354656', 7],
  ['admiralty-navy', 'Admiralty Navy', 'Deep Navy', '#273545', 4],
  ['midnight-harbour', 'Midnight Harbour', 'Deep Navy', '#1D2836', 3],
  ['inkwell-blue', 'Inkwell Blue', 'Deep Navy', '#161F2B', 2],
];

export const ILLUSTRATIVE_PALETTE: IllustrativePaletteSwatch[] = RAW_SWATCHES.map(
  ([id, name, family, hex, lrv, category]) => {
    const guidance = FAMILY_GUIDANCE[family];
    const tone: IllustrativePaletteSwatch['tone'] =
      lrv >= 60 ? 'light' : lrv >= 25 ? 'mid' : 'dark';
    return {
      id,
      name,
      family,
      category: category ?? 'Architectural Mineral',
      hex,
      lrv,
      tone,
      sheenLabel: tone === 'light' ? 'Velvet Matte (3–5%)' : 'Architectural Low-Sheen (6–8%)',
      recommendedSubstrate: guidance.substrate,
      lightingBehavior: guidance.lighting,
      isIllustrative: true,
    };
  }
);
