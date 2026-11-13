export interface ServiceDetail {
  slug: string;
  number: string;
  title: string;
  category: string;
  shortDescription: string;
  fullDescription: string;
  heroImage: string;
  tolerances: string;
  chemistry: string;
  features: string[];
  processSteps: { step: string; title: string; desc: string }[];
  substrateSuitability: string[];
}

export const SERVICES_DATA: ServiceDetail[] = [
  {
    slug: 'interior-architectural-painting',
    number: '01',
    title: 'Interior Architectural Painting',
    category: 'Residential & Commercial Architecture',
    shortDescription: 'Level 5 finish standards, precision shadow lines, and light-responsive pigment depths.',
    fullDescription: 'Specialized full-scale interior coatings engineered to AS/NZS 2311 Level 5 specifications. We ensure continuous planar uniformity, micro-sanded drywalls, and crisp intersections across high-raking light environments.',
    heroImage: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1800&q=80',
    tolerances: 'Planar deviation < 1.5mm across 2m straightedge; zero orange-peel stipple under 500-lumen raking light.',
    chemistry: 'Ultra-low VOC acrylic polymers, mineral silicates, and deep-matte non-reflective formulations.',
    features: [
      'Level 5 Plasterboard Skim & Machine Sanding',
      'Ultra-Low Sheen & Deep Velvet Matte Formulations',
      'Shadow Line & Reveal Junction Precision',
      'Dust-Free HEPA Sanding Extraction On-Site',
      'Diurnal Light Balancing & Bespoke Swatch Verification',
    ],
    processSteps: [
      { step: '01', title: 'Substrate Diagnostics', desc: 'Moisture equilibrium testing and mechanical planar scanning.' },
      { step: '02', title: 'Planar Skim Pass', desc: 'Continuous setting skim coat across board joints and paper face.' },
      { step: '03', title: 'HEPA Orbital Sanding', desc: 'Dual-action sanding under high-intensity inspection floodlights.' },
      { step: '04', title: 'Micron-Spray Application', desc: 'Airless spray and back-rolling with calibrated film thickness.' },
    ],
    substrateSuitability: ['Plasterboard', 'Hardwall Plaster', 'Architectural Precast Concrete', 'Timber Paneling'],
  },
  {
    slug: 'exterior-facade-restoration',
    number: '02',
    title: 'Exterior Facade Restoration & Coatings',
    category: 'Protective & Architectural Exterior Finishes',
    shortDescription: 'Breathable mineral silicates and protective elastomeric systems built for extreme weather.',
    fullDescription: 'Comprehensive facade remediation and architectural coating systems designed for coastal, heritage, and contemporary external structures. Engineered to resist UV degradation, salt-mist ingress, and thermal movement.',
    heroImage: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1800&q=80',
    tolerances: 'Vapor permeability Class 1; dynamic crack bridging up to 1.8mm at -10°C to +50°C.',
    chemistry: 'Potassium mineral silicates, siloxane-modified acrylics, and elastomeric polymer barriers.',
    features: [
      'Elastomeric Waterproof & Crack-Bridging Membranes',
      'Pure Potassium Silicate Mineral Petrification',
      'Salt-Mist & Marine Coastal Resilience',
      'High-Pressure Controlled Substrate Cleaning',
      '10-Year Manufacturer Guaranteed Systems',
    ],
    processSteps: [
      { step: '01', title: 'Bio & Efflorescence Removal', desc: 'High-temperature low-pressure biocidal washing.' },
      { step: '02', title: 'Structural Crack Remediation', desc: 'Polyurethane stitching and flexible joint sealant replacement.' },
      { step: '03', title: 'Stabilizing Mineral Primer', desc: 'Deep penetration primer to consolidate friable render.' },
      { step: '04', title: 'Dual Topcoat Matrix', desc: 'Spray or masonry-roller application of UV-reflective coatings.' },
    ],
    substrateSuitability: ['Cement Render', 'Off-Form Concrete', 'Hebel Panels', 'Clay Masonry & Brickwork'],
  },
  {
    slug: 'fine-cabinetry-millwork',
    number: '03',
    title: 'Fine Cabinetry & Millwork Lacquering',
    category: 'Artisanal Joinery & Bespoke Furniture',
    shortDescription: 'Factory-grade spray finishing, 2K polyurethanes, and velvet satin cabinetry finishes.',
    fullDescription: 'Precision spray finishes applied both on-site within sealed micro-containment booths and in off-site controlled spray facilities. We achieve furniture-grade conversion finishes with scratch-resistant polymer matrices.',
    heroImage: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1800&q=80',
    tolerances: 'Dry film thickness 120-150 microns; cross-hatch adhesion ASTM D3359 Class 5B.',
    chemistry: 'Catalyzed 2K polyurethanes, conversion varnishes, and water-borne hybrid lacquers.',
    features: [
      'Catalyzed 2K Polyurethane In-Situ Spraying',
      'Dust-Free Temporary Cleanroom Containment',
      'Dead-Flat, Eggshell, Satin & High-Gloss Sheens',
      'Grain Filling, Hand-Rubbed & French Wax Finishes',
      'Chemical & Moisture Resistance for Kitchens and Wet Areas',
    ],
    processSteps: [
      { step: '01', title: 'Deconstruction & Masking', desc: 'Disassembly of hardware and negative-pressure zone setup.' },
      { step: '02', title: 'Grain Filling & Primer', desc: 'High-build polyurethane sanding surfacer application.' },
      { step: '03', title: 'Intermediate Sanding', desc: 'Micro-grit wet sanding between coats (P320–P600).' },
      { step: '04', title: 'Topcoat Atomization', desc: 'HVLP fine-finish spray application under dust extraction.' },
    ],
    substrateSuitability: ['MDF & Veneers', 'Hardwood Joinery', 'Architectural Wall Paneling', 'Custom Vanities'],
  },
  {
    slug: 'artisanal-plasters-lime-washes',
    number: '04',
    title: 'Artisanal Plasters & Lime Washes',
    category: 'Decorative & Mineral Finishes',
    shortDescription: 'Hand-trowelled Venetian plaster, slaked lime washes, and organic marmorino textures.',
    fullDescription: 'Tactile, mineral-rich wall treatments that bring depth, organic variation, and natural radiance to architectural spaces. Sourced from authentic Italian limestone pits and crafted with master hand techniques.',
    heroImage: 'https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=1800&q=80',
    tolerances: 'Natural artisanal variation; hand-burnished surface sheen 15% to 85% gloss reflectance.',
    chemistry: 'Slaked lime (calcium hydroxide), crushed Carrara marble, and natural iron oxide pigments.',
    features: [
      'Authentic Venetian Marmorino & Intonachino',
      'Slaked Lime Wash with Natural Chromatic Mottling',
      'Seamless Microcement Bathrooms & Wet Zones',
      'Naturally Antimicrobial & Breathable Walls',
      'Zero-VOC Non-Toxic Composition',
    ],
    processSteps: [
      { step: '01', title: 'Quartz Grip Primer', desc: 'Coarse mineral primer to ensure mechanical interlock.' },
      { step: '02', title: 'Base Scratch Coat', desc: 'Even leveling pass of coarse lime-marble mortar.' },
      { step: '03', title: 'Finish Layer & Burnish', desc: 'Ultra-thin final coat burnished with Japanese steel trowel.' },
      { step: '04', title: 'Natural Carnauba Wax', desc: 'Protective water-repellent buffed wax seal.' },
    ],
    substrateSuitability: ['Cement Sheeting', 'Flush Plasterboard', 'Poured Concrete', 'Brick & Masonry'],
  },
  {
    slug: 'historic-heritage-conservation',
    number: '05',
    title: 'Historic & Heritage Conservation',
    category: 'Heritage Restoration & Archival Craft',
    shortDescription: 'Period molding restoration, archival paint analysis, and heritage pigment matching.',
    fullDescription: 'Conservation of Victorian, Edwardian, and mid-century architectural fabrics. We combine historical archival pigment studies with gentle lead-safe paint removal and hand-cast plaster stabilization.',
    heroImage: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1800&q=80',
    tolerances: 'Strict adherence to Australia ICOMOS Burra Charter guidelines.',
    chemistry: 'Archival distempers, pure linseed oil paints, and lime-putty formulations.',
    features: [
      'Non-Destructive Paint Stratigraphy Analysis',
      'Lead Remediation & HEPA Negative-Pressure Containment',
      'Lath-and-Plaster Cornice & Ceiling Repair',
      'Archival Tint & Period Sheen Replication',
      'Substrate Consolidation for Aged Timbers',
    ],
    processSteps: [
      { step: '01', title: 'Microscopic Paint Audit', desc: 'Core sampling to determine historical layer chronology.' },
      { step: '02', title: 'Safe Stripping & Containment', desc: 'Infrared gentle thermal paint softening and scrapers.' },
      { step: '03', title: 'Substrate Consolidation', desc: 'Re-securing lath, reinforcing plaster keys, and filling.' },
      { step: '04', title: 'Archival Re-Coating', desc: 'Period-correct brush application of breathable lime/mineral paints.' },
    ],
    substrateSuitability: ['19th Century Lath & Plaster', 'Carved Timber Trims', 'Wrought Iron', 'Sandstone Elements'],
  },
  {
    slug: 'commercial-hospitality-finishes',
    number: '06',
    title: 'Commercial & Hospitality Finishes',
    category: 'High-Traffic Luxury Spaces',
    shortDescription: 'High-impact durability for boutique retail, luxury hotels, and flagship galleries.',
    fullDescription: 'High-throughput surface finishing designed for luxury commercial environments requiring relentless durability, acoustic damping, and swift, after-hours or phased delivery with zero commercial disruption.',
    heroImage: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1800&q=80',
    tolerances: 'High scuff resistance rating ASTM D2486; washable up to 5,000 scrub cycles.',
    chemistry: 'Epoxy floor coatings, scuff-resistant cross-linked acrylics, and antimicrobial hygiene coatings.',
    features: [
      'Accelerated After-Hours & Phased Night Shift Handover',
      'Extreme Scuff-Resistant Acrylic Technology',
      'Anti-Microbial & Food-Safe Certified Surfaces',
      'Acoustic Ceiling & High-Volume Spray Solutions',
      'SWMS & Commercial EHS Compliance',
    ],
    processSteps: [
      { step: '01', title: 'Logistics & Trade Coordination', desc: 'After-hours site access and zone containment planning.' },
      { step: '02', title: 'Rapid Surface Abrasion', desc: 'Dustless planetary sanding of heavy-traffic substrates.' },
      { step: '03', title: 'Fast-Cure Primers', desc: 'Epoxy and adhesion-promoter rapid drying primers.' },
      { step: '04', title: 'High-Output Spray Finish', desc: 'High-volume low-overspray architectural delivery.' },
    ],
    substrateSuitability: ['Steel & Metal Framework', 'Commercial Drywall', 'Polished Concrete Floors', 'Exposed Structural Ceilings'],
  },
];
