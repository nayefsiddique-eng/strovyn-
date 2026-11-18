import { CompanySettings, NavigationItem } from './types';

/**
 * Company Information Constants — Strovyn Painting Co.
 * Source of truth: https://strovyn.com/
 * Verified location: Adelaide, South Australia (No street address fabricated)
 * Confirmed WhatsApp: 0406 646 061 (+61406646061)
 */
export const COMPANY_INFO: CompanySettings = {
  name: 'Strovyn Painting Co.',
  tagline: 'Premium residential & commercial painting. Precision prep, flawless finish, colour as craft.',
  description:
    'Premium residential and commercial painters in Adelaide, South Australia. Substrate diagnostics, zero-tolerance prep, dust-controlled sanding, hand-cut lines, and daylight sign-off.',
  contact: {
    phone: '0406 646 061',
    address: {
      street: 'Adelaide, South Australia',
      city: 'Adelaide',
      state: 'South Australia',
      postalCode: '',
      country: 'Australia',
    },
  },
  businessHours: 'Consultations by appointment across Greater Adelaide',
  licenseNumber: '[Licence details available upon written tender enquiry]',
  serviceArea: 'Adelaide, South Australia',
  socialMedia: {},
  meta: {
    title: 'Strovyn Painting Co. | Premium Painters Adelaide, South Australia',
    description:
      'Strovyn Painting Co. — Premium residential and commercial painters in Adelaide, South Australia. Precision prep, flawless finish, and free on-site consultations.',
    ogImage: '/images/og-default.jpg',
  },
};

/**
 * Confirmed WhatsApp & Contact Details
 */
export const WHATSAPP_DETAILS = {
  displayNumber: '0406 646 061',
  internationalDisplay: '+61 406 646 061',
  internationalRaw: '+61406646061',
  chatUrl: 'https://wa.me/61406646061',
  defaultEnquiryMessage: encodeURIComponent(
    'Hello Strovyn Painting Co. I would like to enquire about a painting project in Adelaide.'
  ),
  getDirectChatUrl(serviceName?: string): string {
    const text = serviceName
      ? `Hello Strovyn Painting Co. I would like to enquire about ${serviceName} in Adelaide.`
      : 'Hello Strovyn Painting Co. I would like to enquire about a painting project in Adelaide.';
    return `https://wa.me/61406646061?text=${encodeURIComponent(text)}`;
  },
};

/**
 * Primary Navigation Items
 */
export const NAV_ITEMS: NavigationItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'Projects', href: '/projects' },
  { label: 'Insights', href: '/insights' },
  { label: 'Careers', href: '/careers' },
  { label: 'Contact', href: '/contact' },
];

/**
 * Core Disciplines
 */
export const SERVICE_CATEGORIES = [
  'Interior Precision',
  'Exterior Cladding',
  'Commercial & Heritage',
  'Cabinet Refinishing',
  'Woodwork & Joinery',
] as const;
