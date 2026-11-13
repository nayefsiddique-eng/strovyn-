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
  { label: "Restoration & Heritage", href: "/services#restoration" },
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
  const [currentYear, setCurrentYear] = React.useState(2026);

  React.useEffect(() => {
    setCurrentYear(new Date().getFullYear());
  }, []);

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
                  Specialized in premium architectural painting, heritage
                  restoration, and bespoke surface treatments. Built on an
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
                    Email Inquiries
                  </span>
                  <a
                    href="mailto:contact@strovyn.com"
                    className="hover:text-bronze transition-colors block text-warm-grey break-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze"
                  >
                    contact@strovyn.com
                  </a>
                </div>

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
                    Service Region &amp; Hours
                  </span>
                  <address className="not-italic text-warm-grey leading-relaxed text-xs">
                    Greater Adelaide Metropolitan, South Australia<br />
                    Mon–Sat: 7:00 AM – 5:00 PM ACST
                  </address>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom Bar: Thin top border, copyright, legal links */}
      <div className="border-t border-warm-grey/15 py-8">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-light text-warm-grey-dark">
            <p>
              &copy; {currentYear} Strovyn Painting Co. All rights reserved.
            </p>

            <nav
              aria-label="Legal navigation"
              className="flex items-center gap-6"
            >
              <Link
                href="/privacy"
                className="hover:text-bronze transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze"
              >
                Privacy Policy
              </Link>
              <span className="text-warm-grey/30" aria-hidden="true">
                /
              </span>
              <Link
                href="/terms"
                className="hover:text-bronze transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze"
              >
                Terms of Service
              </Link>
              <span className="text-warm-grey/30" aria-hidden="true">
                /
              </span>
              <Link
                href="/cookies"
                className="hover:text-bronze transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-bronze"
              >
                Cookie Preferences
              </Link>
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
