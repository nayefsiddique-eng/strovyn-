'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { WHATSAPP_DETAILS } from '@/lib/constants';

export interface FinalContactProps {
  className?: string;
  quoteHref?: string;
}

export const FinalContact: React.FC<FinalContactProps> = ({
  className = '',
  quoteHref = '/contact',
}) => {
  return (
    <section
      id="contact-section"
      aria-label="Commence an Architectural Project"
      className={`relative w-full bg-[#141513] text-white py-24 md:py-36 border-t border-warm-grey/30 overflow-hidden ${className}`}
    >
      {/* Background Architectural Photography with subtle zoom & dark grading */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <Image
          src="/images/architectural-pavilion.jpg"
          alt="Architectural pavilion by Strovyn Painting Co."
          fill
          sizes="100vw"
          className="object-cover object-center filter brightness-[0.25] contrast-[1.1] scale-105"
        />
        {/* Subtle Dark Radial Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#141513] via-[#141513]/70 to-[#141513]/85" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Required Headlines and Copy */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-bronze font-medium">
                [ 06 / CONSULTATION &amp; SPECIFICATION ]
              </span>
              <span className="w-12 h-[1px] bg-bronze/60" />
            </div>

            {/* Exact Required Headline */}
            <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-[1.1] mb-6">
              Ready to Transform Your Space?
            </h2>

            {/* Exact Required Supporting Text */}
            <p className="font-sans text-base sm:text-xl text-warm-grey-light max-w-2xl leading-relaxed mb-10 font-light">
              Let&apos;s discuss your next painting project.
            </p>

            {/* Exact Required Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-5">
              <Link
                href={quoteHref}
                className="group inline-flex items-center justify-center gap-5 bg-brand-red hover:bg-brand-red-dark text-white px-8 sm:px-10 py-4 font-mono text-xs uppercase tracking-[0.2em] font-medium transition-all duration-300 shadow-xl cursor-pointer"
              >
                <span>Request a Quote</span>
                <span className="text-white transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-0.5">
                  ↗
                </span>
              </Link>

              {/* Official WhatsApp Button */}
              <a
                href={`${WHATSAPP_DETAILS.chatUrl}?text=Hello%20Strovyn%20Painting%20Co.%20I%20would%20like%20to%20discuss%20an%20architectural%20painting%20project%20in%20Adelaide.`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-3 border border-emerald-500/50 bg-emerald-950/40 hover:bg-emerald-900/60 text-white px-8 py-4 font-mono text-xs uppercase tracking-[0.2em] font-medium transition-colors cursor-pointer"
              >
                <svg
                  className="w-4 h-4 text-emerald-400"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
                <span>Chat on WhatsApp</span>
              </a>
            </div>
          </motion.div>

          {/* Right Column: Specification & Adelaide Coordinates Box */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            className="lg:col-span-4 border border-white/20 bg-[#1D1E1B] p-6 sm:p-8"
          >
            <div className="border-b border-white/15 pb-4 mb-6">
              <span className="font-mono text-[10px] text-bronze uppercase tracking-widest font-semibold block mb-1">
                [ON-SITE INTAKE SPEC]
              </span>
              <h3 className="font-serif text-xl text-white font-normal">
                Direct Contact &amp; Consultations
              </h3>
            </div>

            <ul className="space-y-4 font-sans text-xs text-warm-grey-light">
              <li className="flex items-start gap-3">
                <span className="font-mono text-bronze font-semibold">01</span>
                <div>
                  <strong className="text-white block font-medium">Free On-Site Consultations</strong>
                  <span>Comprehensive substrate diagnostics across greater Adelaide.</span>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="font-mono text-bronze font-semibold">02</span>
                <div>
                  <strong className="text-white block font-medium">WhatsApp Direct Line</strong>
                  <span className="font-mono text-emerald-400 font-semibold">{WHATSAPP_DETAILS.displayNumber}</span>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="font-mono text-bronze font-semibold">03</span>
                <div>
                  <strong className="text-white block font-medium">Official Correspondence</strong>
                  <span className="text-white/80">contact@strovyn.com</span>
                </div>
              </li>
            </ul>

            <div className="border-t border-white/15 pt-5 mt-6 flex items-center justify-between text-[11px] font-mono text-white/60">
              <span>LOCATION:</span>
              <span className="text-white font-medium">ADELAIDE, SOUTH AUSTRALIA</span>
            </div>
          </motion.div>
        </div>

        {/* Bottom Process Indicators Bar */}
        <div className="mt-16 pt-8 border-t border-white/15 flex flex-wrap items-center justify-between gap-6 text-xs font-mono text-white/60">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-brand-red" />
            <span>LEVEL 5 RESIDENTIAL &amp; COMMERCIAL ARCHITECTURAL SPECIFICATIONS</span>
          </div>

          <div className="flex items-center gap-6">
            <span>ADELAIDE SA</span>
            <span className="text-bronze">/</span>
            <span>GREATER ADELAIDE REGION</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalContact;
