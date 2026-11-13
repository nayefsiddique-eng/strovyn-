import { CompanySettings, NavigationItem } from './types';

/**
 * Company Information Constants
 * NOTE: All placeholder values are explicitly labeled with [PLACEHOLDER: ...]
 * to avoid fabricating authentic company records.
 */
export const COMPANY_INFO: CompanySettings = {
  name: 'Strovyn Painting Co.',
  tagline: '[PLACEHOLDER: Fine Architectural Finishing & Interior Aesthetics]',
  description:
    '[PLACEHOLDER: High-end architectural painting, custom finishes, and heritage restoration for luxury residences and distinct commercial spaces.]',
  contact: {
    email: '[PLACEHOLDER: contact@strovynpainting.com]',
    phone: '[PLACEHOLDER: +1 (555) 019-2834]',
    address: {
      street: '[PLACEHOLDER: 400 Artisan Boulevard, Suite 100]',
      city: '[PLACEHOLDER: Metropolis]',
      state: '[PLACEHOLDER: State]',
      postalCode: '[PLACEHOLDER: 00000]',
      country: '[PLACEHOLDER: United States]',
    },
  },
  businessHours: '[PLACEHOLDER: Monday – Friday: 7:30 AM – 5:30 PM | Saturday by Appointment]',
  licenseNumber: '[PLACEHOLDER: State Contractor License #00000000]',
  serviceArea: '[PLACEHOLDER: Greater Metropolitan Region & Private Coastal Estates]',
  socialMedia: {
    instagram: '[PLACEHOLDER: https://instagram.com/strovynpainting]',
    linkedin: '[PLACEHOLDER: https://linkedin.com/company/strovyn-painting]',
    pinterest: '[PLACEHOLDER: https://pinterest.com/strovynpainting]',
    facebook: '[PLACEHOLDER: https://facebook.com/strovynpainting]',
  },
  meta: {
    title: 'Strovyn Painting Co. | Architectural Painting & Fine Finishes',
    description:
      'Premier architectural painting, precision decorative finishes, and historic surface restoration for residential and commercial spaces.',
    ogImage: '/images/og-default.jpg',
  },
};

/**
 * Primary Navigation Items
 */
export const NAV_ITEMS: NavigationItem[] = [
  {
    label: 'Services',
    href: '/services',
    description: 'Bespoke finishing, interior architecture, and exterior protection',
    children: [
      { label: 'Interior Architectural Painting', href: '/services/interior-painting' },
      { label: 'Exterior Restoration & Coatings', href: '/services/exterior-painting' },
      { label: 'Cabinetry & Fine Millwork', href: '/services/cabinetry-millwork' },
      { label: 'Artisanal & Decorative Finishes', href: '/services/decorative-finishes' },
      { label: 'Historic Preservation', href: '/services/historic-preservation' },
      { label: 'Commercial & Hospitality Spaces', href: '/services/commercial' },
    ],
  },
  {
    label: 'Portfolio',
    href: '/portfolio',
    description: 'Selected commissions and architectural transformations',
  },
  {
    label: 'About',
    href: '/about',
    description: 'Our heritage, craftsmanship standards, and dedication to excellence',
  },
  {
    label: 'Journal',
    href: '/journal',
    description: 'Perspectives on color theory, architectural trends, and material craft',
  },
  {
    label: 'Careers',
    href: '/careers',
    description: 'Join our guild of master craftspeople and finishing technicians',
  },
  {
    label: 'Contact',
    href: '/contact',
    description: 'Initiate a project dialogue or consultation request',
  },
];

/**
 * Service Categories
 */
export const SERVICE_CATEGORIES = [
  {
    id: 'interior-painting',
    name: 'Interior Architectural Painting',
    slug: 'interior-painting',
    shortDescription: '[PLACEHOLDER: Precision interior surface preparation and architectural coating application.]',
  },
  {
    id: 'exterior-painting',
    name: 'Exterior Restoration & Coatings',
    slug: 'exterior-painting',
    shortDescription: '[PLACEHOLDER: Weather-resilient architectural coatings and facade restoration.]',
  },
  {
    id: 'cabinetry-millwork',
    name: 'Cabinetry & Fine Millwork',
    slug: 'cabinetry-millwork',
    shortDescription: '[PLACEHOLDER: Factory-level conversion varnishes and hand-rubbed lacquer finishes.]',
  },
  {
    id: 'decorative-finishes',
    name: 'Artisanal & Decorative Finishes',
    slug: 'decorative-finishes',
    shortDescription: '[PLACEHOLDER: Venetian plasters, lime washes, roman clay, and bespoke textured surfaces.]',
  },
  {
    id: 'historic-preservation',
    name: 'Historic Preservation',
    slug: 'historic-preservation',
    shortDescription: '[PLACEHOLDER: Sensitive conservation and period-accurate color matching for landmark structures.]',
  },
  {
    id: 'commercial',
    name: 'Commercial & Hospitality Spaces',
    slug: 'commercial',
    shortDescription: '[PLACEHOLDER: High-traffic commercial environments executed with minimal operational disruption.]',
  },
] as const;

/**
 * Social Media Links Structure
 */
export const SOCIAL_LINKS = [
  {
    platform: 'Instagram',
    url: '[PLACEHOLDER: https://instagram.com/strovynpainting]',
    handle: '@strovynpainting',
  },
  {
    platform: 'LinkedIn',
    url: '[PLACEHOLDER: https://linkedin.com/company/strovyn-painting]',
    handle: 'Strovyn Painting Co.',
  },
  {
    platform: 'Pinterest',
    url: '[PLACEHOLDER: https://pinterest.com/strovynpainting]',
    handle: 'strovynpainting',
  },
  {
    platform: 'Facebook',
    url: '[PLACEHOLDER: https://facebook.com/strovynpainting]',
    handle: 'Strovyn Painting Co.',
  },
] as const;

/**
 * Footer Navigation Groups
 */
export const FOOTER_NAV_GROUPS = [
  {
    title: 'Services',
    links: [
      { label: 'Interior Painting', href: '/services/interior-painting' },
      { label: 'Exterior Coating', href: '/services/exterior-painting' },
      { label: 'Cabinetry & Millwork', href: '/services/cabinetry-millwork' },
      { label: 'Decorative Finishes', href: '/services/decorative-finishes' },
      { label: 'Historic Preservation', href: '/services/historic-preservation' },
      { label: 'Commercial Spaces', href: '/services/commercial' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Our Portfolio', href: '/portfolio' },
      { label: 'Craft Standards', href: '/about#standards' },
      { label: 'Careers', href: '/careers' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    title: 'Journal',
    links: [
      { label: 'All Articles', href: '/journal' },
      { label: 'Color Forecasts', href: '/journal?category=color-forecast' },
      { label: 'Material Care', href: '/journal?category=material-care' },
      { label: 'Case Studies', href: '/journal?category=case-studies' },
    ],
  },
  {
    title: 'Inquiries',
    links: [
      { label: 'Request a Quote', href: '/quote' },
      { label: 'Client Feedback', href: '/feedback' },
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
    ],
  },
] as const;
