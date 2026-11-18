"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui";

export interface FooterProps {
  className?: string;
}

const servicesLinks = [
  { label: "Interior Painting", href: "/services#interior" },
  { label: "Exterior Painting", href: "/services#exterior" },
  { label: "Architectural Finishes", href: "/services#architectural" },
  { label: "Commercial Painting", href: "/services#commercial" },
  { label: "Color Consultation", href: "/services#consultation" },
  { label: "Wall Colour Visualiser", href: "/visualiser" },
  { label: "Surface Restoration", href: "/services#restoration" },
];

const companyLinks = [
  { label: "About", href: "/about" },
  { label: "Projects", href: "/projects" },
  { label: "Insights", href: "/insights" },
  { label: "Careers", href: "/careers" },
  { label: "Contact", href: "/contact" },
];

const socialLinks = [
  { label: "Instagram", href: "https://instagram.com" },
  { label: "LinkedIn", href: "https://linkedin.com" },
  { label: "Pinterest", href: "https://pinterest.com" },
  { label: "Facebook", href: "https://facebook.com" },
];

export const Footer: React.FC<FooterProps> = ({ className }) => {
  const currentYear = 2026;
  // Temporary honest disclosure state until approved legal copy is provided for /privacy, /terms, /cookies
  const [legalNotice, setLegalNotice] = React.useState<'privacy' | 'terms' | 'cookies' | null>(null);

  const toggleNotice = (key: 'privacy' | 'terms' | 'cookies') => {
    setLegalNotice((prev) => (prev === key ? null : key));
  };

  return (
    <footer
      className={`bg-charcoal text-warm-grey border-t border-charcoal-light font-sans ${
        className || ""
      }`}
    >
      {/* Top Section: "Let's Create Something Beautiful" CTA */}
      <section
        aria-label="Call to action"
        className="border-b border-warm-grey/15 py-16 sm:py-20 lg:py-24"
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 lg:gap-16">
            <div className="max-w-3xl">
              <span className="block text-xs uppercase tracking-[0.2em] text-bronze font-sans mb-3 font-medium">
                Inquiries & Commissions
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-white font-normal tracking-tight leading-[1.1]">
                Let&apos;s Create Something Beautiful
              </h2>
              <p className="mt-5 text-warm-grey text-base sm:text-lg max-w-2xl font-light leading-relaxed">
                From curated private residences to expansive commercial spaces,
                our master painters bring architectural precision, refined
                craftsmanship, and enduring beauty to every surface.
              </p>
            </div>
            <div className="shrink-0 pt-2 lg:pt-0">
              <Button
                href="/contact"
                variant="primary"
                size="lg"
                className="tracking-[0.16em] w-full sm:w-auto"
              >
                Get a Quote
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid: 4 Columns */}
      <section
        aria-label="Directory and contact details"
        className="py-16 sm:py-20 lg:py-24"
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8">
            {/* Column 1: Brand, Description, Social Links */}
            <div className="lg:col-span-4 flex flex-col justify-between">
              <div>
                <Link
                  href="/"
                  className="inline-flex items-start focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze"
                  aria-label="Strovyn Painting Co. - Return to homepage"
                >
                  <div className="w-[130px] sm:w-[140px]">
                    <Image
                      src="/images/strovyn-logo.png"
                      alt="Strovyn Painting Co."
                      width={280}
                      height={93}
                      className="w-full h-auto"
                    />
                  </div>
                </Link>
                <p className="mt-6 text-sm text-warm-grey leading-relaxed max-w-sm font-light">
                  Specialized in premium architectural painting, surface
                  restoration, and bespoke finishes. Built on an
                  uncompromising dedication to craft and quiet luxury.
                </p>
              </div>

              {/* Social Links (text-only, no icons) */}
              <div className="mt-8 pt-6 border-t border-warm-grey/10">
                <span className="block text-[11px] uppercase tracking-[0.16em] text-white font-sans font-medium mb-3">
                  Connect
                </span>
                <nav
                  aria-label="Social media links"
                  className="flex flex-wrap gap-x-6 gap-y-2"
                >
                  {socialLinks.map((social) => (
                    <a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs uppercase tracking-[0.12em] text-warm-grey hover:text-bronze transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze"
                    >
                      {social.label}
                    </a>
                  ))}
                </nav>
              </div>
            </div>

            {/* Column 2: Services */}
            <div className="lg:col-span-3">
              <h3 className="text-xs uppercase tracking-[0.16em] text-white font-sans font-medium mb-6">
                Services
              </h3>
              <ul className="space-y-3.5">
                {servicesLinks.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm text-warm-grey hover:text-bronze transition-colors block font-light focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 3: Company */}
            <div className="lg:col-span-2">
              <h3 className="text-xs uppercase tracking-[0.16em] text-white font-sans font-medium mb-6">
                Company
              </h3>
              <ul className="space-y-3.5">
                {companyLinks.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-sm text-warm-grey hover:text-bronze transition-colors block font-light focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Column 4: Contact Info (All labeled as [PLACEHOLDER]) */}
            <div className="lg:col-span-3">
              <h3 className="text-xs uppercase tracking-[0.16em] text-white font-sans font-medium mb-6">
                Contact
              </h3>
              <div className="space-y-4 text-sm font-light text-warm-grey">
                <div>
                  <span className="block text-[10px] uppercase tracking-[0.14em] text-warm-grey-dark mb-1 font-normal">
                    Free Consultations
                  </span>
                  <Link
                    href="/contact"
                    className="hover:text-bronze transition-colors block text-warm-grey focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze"
                  >
                    Book On-Site Adelaide Assessment &rarr;
                  </Link>
                </div>

                <div>
                  <span className="block text-[10px] uppercase tracking-[0.14em] text-warm-grey-dark mb-1 font-normal">
                    Location &amp; Service Region
                  </span>
                  <address className="not-italic text-warm-grey leading-relaxed text-xs">
                    Adelaide, South Australia<br />
                    Serving Greater Adelaide Metropolitan
                  </address>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Bar: Thin top border, copyright, temporary honest legal notice triggers, and mobile bar clearance */}
      <div className="border-t border-warm-grey/15 pt-8 pb-32 md:pb-10">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          {legalNotice && (
            <div
              id="footer-legal-notice"
              role="region"
              aria-label="Legal policy status notice"
              className="mb-6 p-4 border border-warm-grey/25 bg-[#1B1C1A] text-xs text-warm-grey flex flex-col sm:flex-row sm:items-start justify-between gap-4"
            >
              <div className="space-y-1 max-w-3xl leading-relaxed">
                <p className="font-mono text-[11px] uppercase tracking-wider text-bronze font-semibold">
                  {legalNotice === "privacy" && "Privacy Policy — Formal Document Pending Publication"}
                  {legalNotice === "terms" && "Terms of Service — Formal Document Pending Publication"}
                  {legalNotice === "cookies" && "Cookie & Browser Storage Notice"}
                </p>
                {legalNotice === "privacy" && (
                  <p>
                    Strovyn Painting Co. is preparing formal Privacy Policy documentation for website publication. Information submitted through our{" "}
                    <Link href="/contact" className="underline hover:text-white">
                      quotation form
                    </Link>{" "}
                    is used to respond to project enquiries. Please contact our Adelaide team directly for written privacy details prior to engagement.
                  </p>
                )}
                {legalNotice === "terms" && (
                  <p>
                    Strovyn Painting Co. is preparing formal website Terms of Service for publication. Project scopes, coatings specifications, and pricing are established only in written quotations following an on-site Adelaide inspection. Digital visualiser colours are illustrative previews only.
                  </p>
                )}
                {legalNotice === "cookies" && (
                  <p>
                    This site stores an optional display preference (<code className="font-mono text-white">strovyn-theme</code>) in local browser storage and processes Wall Colour Visualiser photos locally inside your browser without automatic uploads. Formal cookie documentation is pending business sign-off.
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setLegalNotice(null)}
                className="self-start px-3 py-1 border border-warm-grey/30 text-[11px] font-mono uppercase tracking-wider text-warm-grey hover:text-white hover:border-white/50 cursor-pointer shrink-0"
              >
                Close
              </button>
            </div>
          )}

          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-light text-warm-grey-dark">
            <p>
              &copy; {currentYear} Strovyn Painting Co. All rights reserved.
            </p>

            {/* Future approved legal routes: /privacy, /terms, /cookies */}
            <nav
              aria-label="Legal navigation"
              className="flex flex-wrap items-center justify-center gap-4 sm:gap-6"
            >
              <button
                type="button"
                onClick={() => toggleNotice("privacy")}
                aria-expanded={legalNotice === "privacy"}
                aria-controls="footer-legal-notice"
                className="hover:text-bronze transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze cursor-pointer"
              >
                Privacy Policy
              </button>
              <span className="text-warm-grey" aria-hidden="true">
                /
              </span>
              <button
                type="button"
                onClick={() => toggleNotice("terms")}
                aria-expanded={legalNotice === "terms"}
                aria-controls="footer-legal-notice"
                className="hover:text-bronze transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze cursor-pointer"
              >
                Terms of Service
              </button>
              <span className="text-warm-grey" aria-hidden="true">
                /
              </span>
              <button
                type="button"
                onClick={() => toggleNotice("cookies")}
                aria-expanded={legalNotice === "cookies"}
                aria-controls="footer-legal-notice"
                className="hover:text-bronze transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze cursor-pointer"
              >
                Cookie Preferences
              </button>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
