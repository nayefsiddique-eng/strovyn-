export interface ProjectData {
  slug: string;
  title: string;
  category: 'Architectural Residential' | 'Heritage Restoration' | 'Artisanal Plasters' | 'Commercial & Hospitality';
  lifecycle: 'Completed' | 'Active On-Site' | 'Handover Phase';
  location: string;
  year: string;
  architect: string;
  builder: string;
  heroImage: string;
  galleryImages: string[];
  scope: string[];
  finishes: string;
  description: string;
  challenges: string;
  sheenLevels: string;
  isDemonstrationSpec?: boolean;
}

/**
 * Project Portfolio Case Studies — Strovyn Painting Co.
 * Real geographic focus: Greater Adelaide, South Australia (Glenelg to Hills, Norwood, Unley, North Adelaide).
 * All sample projects are honestly marked as architectural demonstration specifications until
 * client supplies approved photography rights and verified client case studies.
 */
export const PROJECTS_DATA: ProjectData[] = [
  {
    slug: 'the-north-adelaide-residence',
    title: 'North Adelaide Villa Residence',
    category: 'Architectural Residential',
    lifecycle: 'Completed',
    location: 'North Adelaide, SA',
    year: '2025',
    architect: 'Strovyn Architectural Finishing',
    builder: 'Strovyn Master Painters & Finishes',
    heroImage: '/images/projects/adelaide-luxury-residence/living-dining-2.jpg',
    galleryImages: [
      '/images/projects/adelaide-luxury-residence/living-kitchen-1.jpg',
      '/images/projects/adelaide-luxury-residence/living-dining-2.jpg',
      '/images/projects/adelaide-luxury-residence/kitchen-island-patio-3.jpg',
    ],
    scope: [
      'Comprehensive surface prep across open-plan living, kitchen and dining expanses',
      'Dust-controlled orbital machine sanding throughout architectural walls and ceilings',
      'Ultra-flat interior ceiling and low-sheen wall finishes catching natural daylight',
      'Precision masking and crisp hand-cut trim lines on custom cabinetry and architraves',
    ],
    finishes: 'Substrate Skim // Low-VOC Mineral Matte // Fine Joinery & Trim Finish',
    description: 'A benchmark Adelaide luxury home renovation showcasing Strovyn Painting Co.’s signature interior finish. Ultra-smooth walls, flawless light reflection, and impeccable architectural detailing in high-raking daylight.',
    challenges: 'Balancing bright daylight raking through floor-to-ceiling glass patio doors across seamless ceiling and wall surfaces with zero imperfections.',
    sheenLevels: 'Ceilings: Ultra-Flat 2% // Walls: Low-Sheen Matte 5% // Trim & Joinery: Satin 20%',
    isDemonstrationSpec: false,
  },
  {
    slug: 'adelaide-hills-coastal-estate',
    title: 'Adelaide Hills Modern Estate',
    category: 'Architectural Residential',
    lifecycle: 'Active On-Site',
    location: 'Crafers, Adelaide Hills SA',
    year: '2026',
    architect: 'Design Reference Spec [Client Case Study Pending]',
    builder: 'Prestige Regional Builder [Demonstration Study]',
    heroImage: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1200&q=80',
    ],
    scope: [
      'Exterior facade weatherproofing and high-performance protective coatings',
      'Breathable mineral masonry coatings resistant to heavy temperature shifts',
      'Fine architectural woodwork and exposed structural timber lacquering',
    ],
    finishes: 'Elastomeric Masonry Barrier // Silicate Exterior // Timber Satin Seal',
    description: 'Specialized finishing demonstration designed for Adelaide Hills climate extremes. Balances UV resilience, moisture vapor permeability, and natural matte aesthetics.',
    challenges: 'Wide diurnal temperature variations managed with flexible crack-bridging primers and moisture-equilibrium test protocols before application.',
    sheenLevels: 'Exterior Render: Low-Sheen 5% // Timber Elements: Satin 25%',
    isDemonstrationSpec: true,
  },
  {
    slug: 'norwood-heritage-villa',
    title: 'Norwood Victorian Villa Restoration',
    category: 'Heritage Restoration',
    lifecycle: 'Completed',
    location: 'Norwood, Adelaide SA',
    year: '2024',
    architect: 'Heritage Conservation Spec [Demonstration Study]',
    builder: 'Craftsman Heritage Restorations [Demonstration Study]',
    heroImage: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80',
    ],
    scope: [
      'Gentle thermal removal of failed historical enamel on period woodwork',
      'Restoration of lath-and-plaster ceiling roses and decorative cornices',
      'Breathable period-authentic mineral coatings suited to bluestone masonry',
    ],
    finishes: 'Breathable Distemper // Traditional Enamel // Lime Consolidation',
    description: 'Heritage restoration portfolio specification celebrating Adelaide Victorian and Queen Anne architecture. Focuses on substrate preservation and period-correct chromatic balance.',
    challenges: 'Ensuring masonry can breathe freely without modern synthetic moisture entrapment.',
    sheenLevels: 'Ceilings & Plaster: Flat Chalk 1% // Woodwork: Traditional Gloss 65%',
    isDemonstrationSpec: true,
  },
  {
    slug: 'unley-park-bespoke-residence',
    title: 'Unley Park Residence & Joinery',
    category: 'Artisanal Plasters',
    lifecycle: 'Handover Phase',
    location: 'Unley Park, Adelaide SA',
    year: '2026',
    architect: 'Interior Design Spec [Demonstration Study]',
    builder: 'Boutique Residential Builder [Demonstration Study]',
    heroImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1800&q=80',
    galleryImages: [
      'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80',
    ],
    scope: [
      'Burnished Venetian Marmorino feature walls and curved fireplace surround',
      'Fine cabinetry conversion lacquering across bespoke oak millwork',
      'Daylight inspection sign-off across all living zones',
    ],
    finishes: 'Italian Marmorino // Catalyzed Joinery Polyurethane // Micro-Sanded Walls',
    description: 'Tactile surface finishing demonstration highlighting the intersection between fine cabinetry lacquering and hand-troweled mineral plasters.',
    challenges: 'Executing seamless curved plaster planes without visible lap marks under continuous raking downlights.',
    sheenLevels: 'Plaster: Hand-Burnished Wax 40% // Millwork: Velvet Matte 15%',
    isDemonstrationSpec: true,
  },
];
