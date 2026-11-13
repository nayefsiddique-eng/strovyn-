export interface ArticleData {
  slug: string;
  title: string;
  category: string;
  excerpt: string;
  content: string[];
  readTime: string;
  date: string;
  author: string;
  authorRole: string;
  coverImage: string;
}

export const ARTICLES_DATA: ArticleData[] = [
  {
    slug: 'achieving-as-nzs-2311-level-5-surface-standards',
    title: 'Achieving AS/NZS 2311 Level 5 Surface Standards in High-Raking Sunlight',
    category: 'Surface Preparation',
    excerpt: 'Why standard plasterboard joints fail under low-angle morning sunlight and the systematic dual-skim protocol required to eliminate joint telegraphing.',
    readTime: '6 min read',
    date: 'February 12, 2026',
    author: 'Liam Vance',
    authorRole: 'Master Finishing Specialist',
    coverImage: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1200&q=80',
    content: [
      'In contemporary residential architecture, expansive glazing units and minimalist shadow-line reveals have transformed ceilings into architectural focal points. However, this architectural freedom brings a merciless physical reality: raking light.',
      'Under low sun angles, standard Level 4 drywall tape joints reflect light differently than the surrounding plasterboard paper. Even with multiple coats of conventional low-sheen acrylic, optical telegraphing occurs, resulting in visible seam ridges and surface flashing.',
      'The AS/NZS 2311 Level 5 specification mandates an unbroken skim coat across the entire substrate. This equalizes suction, surface texture, and optical reflectance prior to pigment application.',
      'Our protocol employs dual-axis machine orbital sanding with 500-lumen cross-axis inspection lighting. Only when the substrate displays less than 1mm deflection under raking illumination is the final airless spray sequence initiated.',
    ],
  },
  {
    slug: 'chemistry-of-potassium-silicate-mineral-coatings',
    title: 'The Mineral Chemistry of Pure Potassium Silicate Coatings',
    category: 'Paint Chemistry',
    excerpt: 'Unlike acrylic films that form a synthetic skin over masonry, potassium waterglass chemically petrifies into the substrate for century-long permanence.',
    readTime: '5 min read',
    date: 'January 28, 2026',
    author: 'Marcus Bell',
    authorRole: 'Technical Coatings Director',
    coverImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    content: [
      'Conventional exterior paints rely on organic acrylic resins that form a synthetic barrier over masonry. While flexible initially, UV radiation and thermal cycling inevitably cause polymer chain degradation, leading to micro-blistering and chalking.',
      'Potassium silicate coatings, first formulated in 19th-century Bavaria, rely on waterglass (silicic acid potassium salt). When applied to mineral substrates like lime render or concrete, a chemical reaction known as silicification occurs.',
      'The binder reacts with calcium carbonate in the masonry to form insoluble calcium silicate hydrate. The coating does not sit on top of the wall; it becomes an inseparable crystalline extension of the substrate itself.',
      'With Class 1 vapor permeability, moisture freely evaporates from within the wall envelope while external driving rain is repelled, eliminating the primary cause of masonry decay.',
    ],
  },
  {
    slug: 'authentic-venetian-plaster-vs-synthetic-render',
    title: 'Authentic Slaked Lime Plaster vs. Synthetic Textures: The Architect’s Guide',
    category: 'Painting Techniques',
    excerpt: 'Evaluating luminescence, tactile cooling, and acoustic properties between historical marmorino and modern acrylic faux finishes.',
    readTime: '8 min read',
    date: 'January 14, 2026',
    author: 'Elena Rostova',
    authorRole: 'Artisanal Plaster Artisan',
    coverImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80',
    content: [
      'The resurgence of tactile, monolithic wall finishes in luxury residences has created widespread confusion between authentic lime-based plasters and synthetic acrylic-based textured pastes.',
      'Authentic Venetian Marmorino consists of aged slaked lime (calcium hydroxide) blended with crushed Carrara marble dust. It cures through natural carbonation—absorbing ambient carbon dioxide from the air to revert back to solid limestone rock.',
      'This crystalline carbonation creates a microscopic translucency where ambient light penetrates several microns into the surface before scattering, imparting a luminous depth that synthetic acrylic paints can never replicate.',
      'Furthermore, genuine lime plasters remain naturally alkaline (pH 12–13), making them inherently resistant to mold, bacteria, and electrostatic dust accumulation.',
    ],
  },
  {
    slug: 'lead-safe-conservation-protocols-heritage-homes',
    title: 'Lead-Safe Remediation and Archival Paint Stratigraphy in Victorian Mansions',
    category: 'Heritage Care',
    excerpt: 'How non-destructive infrared stripping and microscopic layer analysis preserve historical plaster moldings while eliminating toxicity risks.',
    readTime: '7 min read',
    date: 'November 20, 2025',
    author: 'Julian Vance',
    authorRole: 'Senior Heritage Conservator',
    coverImage: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80',
    content: [
      'Australia’s premier 19th-century residential structures frequently conceal dozens of historical paint layers, often containing high concentrations of toxic lead carbonate and lead chromate.',
      'Abrasive sanding or open-flame blowtorches represent severe health and fire hazards. Modern conservation demands low-temperature infrared heating devices that safely soften aged enamel binders below the lead vaporization point (400°C).',
      'Simultaneously, stratigraphy analysis of microscopic paint core cross-sections reveals the exact chronological sequence of historically documented color schemes.',
      'Our restorers then replicate these historical palettes using natural linseed oil paints and breathable archival distempers that allow ancient lath-and-plaster ceilings to breathe freely.',
    ],
  },
];
