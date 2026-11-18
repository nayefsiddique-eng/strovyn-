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
  featured?: boolean;
}

export const ARTICLES_DATA: ArticleData[] = [
  {
    slug: 'achieving-as-nzs-2311-level-5-surface-standards',
    title: 'Achieving Level 5 Surface Standards in High-Raking Sunlight',
    category: 'Surface Preparation',
    excerpt: 'Why standard plasterboard joints fail under low-angle morning sunlight and the systematic skim protocol required to eliminate joint telegraphing.',
    readTime: '6 min read',
    date: 'February 12, 2026',
    author: 'Strovyn Painting Co.',
    authorRole: 'Surface Preparation',
    coverImage: '/images/architectural-paint-swatch.jpg',
    featured: true,
    content: [
      'In contemporary residential architecture, expansive glazing units and minimalist shadow-line reveals have transformed ceilings into architectural focal points. However, this architectural freedom brings a merciless physical reality: raking light.',
      'Under low sun angles, standard Level 4 drywall tape joints reflect light differently than the surrounding plasterboard paper. Even with multiple coats of conventional low-sheen acrylic, optical telegraphing occurs, resulting in visible seam ridges and surface flashing.',
      'A Level 5 finish requires an unbroken skim coat across the entire plasterboard substrate. This equalises suction, surface texture and optical reflectance prior to pigment application.',
      'During preparation, raking cross-light inspection is used to identify any surface deflection before the final finish coat is applied.',
    ],
  },
  {
    slug: 'chemistry-of-potassium-silicate-mineral-coatings',
    title: 'The Mineral Chemistry of Pure Potassium Silicate Coatings',
    category: 'Paint Chemistry',
    excerpt: 'Unlike acrylic films that form a synthetic skin over masonry, potassium waterglass chemically petrifies into the substrate for century-long permanence.',
    readTime: '5 min read',
    date: 'January 28, 2026',
    author: 'Strovyn Painting Co.',
    authorRole: 'Paint Chemistry',
    coverImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
    content: [
      'Conventional exterior paints rely on organic acrylic resins that form a synthetic barrier over masonry. While flexible initially, UV radiation and thermal cycling inevitably cause polymer chain degradation, leading to micro-blistering and chalking.',
      'Potassium silicate coatings, first formulated in 19th-century Bavaria, rely on waterglass (silicic acid potassium salt). When applied to mineral substrates like lime render or concrete, a chemical reaction known as silicification occurs.',
      'The binder reacts with available calcium hydroxide and mineral compounds within suitable masonry substrates to form insoluble calcium silicate hydrate. Rather than forming only a surface film, the coating chemically bonds with suitable mineral substrates through the silicification process.',
      'Achieving Class 1 vapor permeability under the European EN 1062-1 classification standard, moisture can evaporate naturally from within the wall envelope while external rain penetration is resisted, helping address one of the principal causes of masonry decay in variable climates.',
    ],
  },
  {
    slug: 'authentic-venetian-plaster-vs-synthetic-render',
    title: 'Authentic Slaked Lime Plaster vs. Synthetic Textures: The Architect’s Guide',
    category: 'Painting Techniques',
    excerpt: 'Evaluating luminescence, tactile cooling, and acoustic properties between historical marmorino and modern acrylic faux finishes.',
    readTime: '8 min read',
    date: 'January 14, 2026',
    author: 'Strovyn Painting Co.',
    authorRole: 'Finishing Techniques',
    coverImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1200&q=80',
    content: [
      'The resurgence of tactile, monolithic wall finishes in luxury residences has created widespread confusion between authentic lime-based plasters and synthetic acrylic-based textured pastes.',
      'Authentic Venetian Marmorino consists of aged slaked lime (calcium hydroxide) blended with crushed Carrara marble dust. It cures through natural carbonation—absorbing ambient carbon dioxide from the air to revert back to solid limestone rock.',
      'This crystalline carbonation creates a microscopic translucency where ambient light penetrates beneath the surface before scattering, imparting a luminous depth that conventional synthetic paints do not replicate through the same mechanism.',
      'Furthermore, genuine lime plasters remain naturally alkaline (pH 12–13), making them inherently resistant to mold, bacteria, and electrostatic dust accumulation.',
    ],
  },
  {
    slug: 'lead-safe-conservation-protocols-heritage-homes',
    title: 'Modern Surface Preparation for Residential Painting',
    category: 'Surface Preparation',
    excerpt: 'The fundamental stages of residential surface preparation—from cleaning and substrate repairs to priming, sanding and safe handling of older coatings.',
    readTime: '6 min read',
    date: 'November 20, 2025',
    author: 'Strovyn Painting Co.',
    authorRole: 'Residential Surface Preparation',
    coverImage: '/images/painted-texture-detail.jpg',
    content: [
      'The longevity and visual consistency of any residential paint finish depend fundamentally on thorough surface preparation. Before any topcoat is applied, existing surfaces must be meticulously cleaned to remove dust, grease, contaminants and loose or flaking material that compromise adhesion.',
      'Substrate defects such as minor indentations, hairline plaster cracks, gaps around trim work and surface unevenness require systematic filling and leveling. Once compounds have fully cured, controlled sanding creates a uniform mechanical profile, ensuring subsequent coatings lay flat and adhere reliably.',
      'Applying an appropriate primer or sealer is the crucial bridging step. A high-quality primer stabilizes porous substrates, prevents uneven suction across patched zones, and establishes an optimal base for uniform color and sheen development across all living spaces.',
      'Safety Note on Older Structures: When working in homes constructed prior to 1970, older coating layers may contain hazardous lead-based pigments or other regulated compounds. Suspected hazardous coatings must never be dry-sanded, dry-scraped, or heated with open torches or uncontrolled heat guns. Where older or deteriorating coatings are suspected of containing hazardous materials, work should cease until surfaces are formally tested and addressed by appropriately licensed and qualified environmental remediation professionals.',
    ],
  },
  {
    slug: 'architectural-sheen-selection-raking-light',
    title: 'Architectural Sheen Selection Across High-Raking Daylight Planes',
    category: 'Painting Techniques',
    excerpt: 'How gloss levels from dead-flat mineral coats to eggshell interact with ceiling planes and large glazing elevations across South Australian homes.',
    readTime: '5 min read',
    date: 'October 15, 2025',
    author: 'Strovyn Painting Co.',
    authorRole: 'Finishing Techniques',
    coverImage: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80',
    content: [
      'Selecting an architectural sheen level involves more than aesthetic preference; it governs how light scatters across broad, unshadowed ceiling planes and double-height living areas.',
      'Dead-flat and velvet-matte formulations (1–3% specular gloss) diffuse direct solar radiation omnidirectionally. This optical dispersion significantly reduces the visibility of minor planar substrate variations under critical raking light.',
      'Higher sheen levels—including eggshell and satin—provide superior mechanical washability and burnish resistance, making them ideal for high-traffic corridors, service areas, and architectural joinery.',
      'Balancing light absorption with maintenance durability requires specifying zoned finish schedules that align with room orientation and diurnal sunlight patterns.',
    ],
  },
  {
    slug: 'low-voc-waterborne-enamels-residential-joinery',
    title: 'Waterborne Polyurethane Enamels for Interior Architectural Joinery',
    category: 'Paint Chemistry',
    excerpt: 'Evaluating cross-linking durability, blocking resistance, and ambient air quality across modern waterborne trim finishes.',
    readTime: '5 min read',
    date: 'September 28, 2025',
    author: 'Strovyn Painting Co.',
    authorRole: 'Paint Chemistry',
    coverImage: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1200&q=80',
    content: [
      'Traditional solvent-borne alkyds historically dominated architectural trim and door specifications due to their extended open time and natural self-leveling flow.',
      'Modern waterborne polyurethane acrylic dispersions achieve comparable film build and leveling through engineered cross-linking resins, eliminating lingering solvent off-gassing and yellowing over time.',
      'Advanced waterborne formulations achieve full block resistance within 24 to 48 hours, preventing painted door seals and window reveals from sticking in Adelaide’s summer temperature extremes.',
      'Specifying low-VOC waterborne enamels ensures compliant indoor air quality while delivering a hard-wearing, scrub-resistant finish on millwork, architraves, and skirtings.',
    ],
  },
  {
    slug: 'moisture-equilibration-masonry-coatings',
    title: 'Substrate Moisture Equilibration in Architectural Masonry Painting',
    category: 'Surface Preparation',
    excerpt: 'The diagnostic protocols for evaluating substrate relative humidity and capillary rise before applying exterior coatings.',
    readTime: '6 min read',
    date: 'August 14, 2025',
    author: 'Strovyn Painting Co.',
    authorRole: 'Surface Preparation',
    coverImage: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80',
    content: [
      'Applying barrier paint films over masonry that retains elevated internal moisture is the most common cause of premature coating delamination, blistering, and efflorescence.',
      'Moisture equilibrium must be confirmed prior to coating. Measuring substrate moisture content using electrical impedance and pin-probe diagnostics establishes whether the wall envelope is ready for coating application.',
      'Where masonry remains exposed to ground damp or seasonal vapor drive, breathable micro-porous or mineral silicate systems provide an escape path for moisture vapor, preventing hydraulic pressure from lifting the paint film.',
      'A thorough moisture diagnostic sequence protects both the exterior coating investment and the underlying structural masonry substrate.',
    ],
  },
];

export function getLatestArticles(count: number = 3): ArticleData[] {
  return ARTICLES_DATA.slice(0, count);
}

export function getFeaturedArticle(): ArticleData {
  return ARTICLES_DATA.find((a) => a.featured) || ARTICLES_DATA[0];
}

export function getCategories(): string[] {
  const categories = new Set(ARTICLES_DATA.map((a) => a.category));
  return ['All', ...Array.from(categories)];
}
