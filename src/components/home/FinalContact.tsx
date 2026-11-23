'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { WHATSAPP_DETAILS } from '@/lib/constants';

export interface FinalContactProps {
  className?: string;
  quoteHref?: string;
}

export const FinalContact: React.FC<FinalContactProps> = ({
  className = '',
}) => {
  return (
    <section
      id="contact-section"
      aria-label="Commence an Architectural Project"
      className={`relative w-full bg-brand-red text-white py-20 md:py-28 overflow-hidden ${className}`}
    >
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          
          {/* Left Column: Bold Red Reference Headline and Direct Contacts */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 flex flex-col justify-between"
          >
            <div>
              {/* Reference Header */}
              <span className="font-mono text-xs uppercase tracking-[0.28em] text-white/80 font-medium block mb-4">
                GET A QUOTE
              </span>

              {/* Exact Oversized Reference Headline */}
              <h2 className="type-hero uppercase text-6xl sm:text-7xl lg:text-[5.5rem] text-white leading-[0.9] mb-8 select-none">
                <span className="block">START</span>
                <span className="block">YOUR</span>
                <span className="block text-stroke-white">PROJECT.</span>
              </h2>

              <p className="font-sans text-white/90 text-sm sm:text-base max-w-md leading-relaxed mb-10">
                Premium architectural and residential painting across Greater Adelaide. Let&apos;s discuss your vision and exact finish specifications.
              </p>
            </div>

            {/* Direct Contact Coordinates as shown in mobile reference */}
            <div className="space-y-4 font-sans text-sm text-white/95 pt-4 border-t border-white/20">
              <a
                href={WHATSAPP_DETAILS.chatUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5 text-white/90" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.312.045-.634.044-1.29-.199-.705-.261-1.558-.871-2.261-1.574-.703-.703-1.313-1.556-1.574-2.261-.243-.656-.244-.978-.199-1.29.05-.333.419-1.026.824-1.17.133-.048.28-.023.372.069.13.131.428.985.498 1.157.069.172.035.328-.046.449-.07.104-.15.176-.239.267-.099.1-.177.172-.07.357.144.251.524.846 1.053 1.375.529.529 1.124.909 1.375 1.053.185.107.257.029.357-.07.091-.089.163-.169.267-.239.121-.081.277-.115.449-.046.172.07 1.026.368 1.157.498.092.092.117.239.069.372z" />
                </svg>
                <span className="font-mono tracking-wide">WhatsApp: +61 406 646 061</span>
              </a>

              <div className="flex items-center gap-3 text-white/90">
                <svg className="w-5 h-5 text-white/90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Serving greater Adelaide, South Australia</span>
              </div>
            </div>
          </motion.div>

          {/* Right Column: Clean White Quote Intake Form (Exact Reference Layout) */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
            className="lg:col-span-6 bg-white text-charcoal p-8 sm:p-10 shadow-2xl"
          >
            <h3 className="type-card-title uppercase tracking-wide text-2xl text-charcoal mb-6">
              Request Your Consultation
            </h3>

            <form
              action="/contact"
              method="GET"
              className="space-y-4"
            >
              <div>
                <label htmlFor="quote-name" className="sr-only">Full name</label>
                <input
                  id="quote-name"
                  name="name"
                  type="text"
                  placeholder="Full name"
                  required
                  className="w-full px-4 py-3.5 border border-charcoal/20 text-sm font-sans focus:outline-none focus:border-charcoal bg-transparent"
                />
              </div>

              <div>
                <label htmlFor="quote-email" className="sr-only">Email</label>
                <input
                  id="quote-email"
                  name="email"
                  type="email"
                  placeholder="Email"
                  required
                  className="w-full px-4 py-3.5 border border-charcoal/20 text-sm font-sans focus:outline-none focus:border-charcoal bg-transparent"
                />
              </div>

              <div>
                <label htmlFor="quote-phone" className="sr-only">Phone (optional)</label>
                <input
                  id="quote-phone"
                  name="phone"
                  type="tel"
                  placeholder="Phone (optional)"
                  className="w-full px-4 py-3.5 border border-charcoal/20 text-sm font-sans focus:outline-none focus:border-charcoal bg-transparent"
                />
              </div>

              <div>
                <label htmlFor="quote-service" className="sr-only">Service</label>
                <select
                  id="quote-service"
                  name="service"
                  defaultValue="interior"
                  className="w-full px-4 py-3.5 border border-charcoal/20 text-sm font-sans focus:outline-none focus:border-charcoal bg-transparent text-charcoal/80"
                >
                  <option value="interior">Interior Architectural Painting</option>
                  <option value="exterior">Exterior Facade &amp; Coatings</option>
                  <option value="surface-restoration">Architectural Surface Restoration</option>
                  <option value="plaster">Bespoke Artisan Plasters</option>
                  <option value="commercial">Commercial Specifications</option>
                </select>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full bg-[#111110] hover:bg-black text-white py-4 font-mono text-xs uppercase tracking-[0.24em] font-medium transition-colors"
                >
                  SUBMIT SPECIFICATION
                </button>
              </div>

              <div className="pt-2 text-center">
                <Link
                  href={WHATSAPP_DETAILS.chatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-mono tracking-widest text-charcoal/70 hover:text-charcoal uppercase"
                >
                  <span>Or chat immediately via WhatsApp &rarr;</span>
                </Link>
              </div>
            </form>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FinalContact;
