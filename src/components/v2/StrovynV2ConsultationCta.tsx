'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowUpRight, MessageCircle } from 'lucide-react';
import { WHATSAPP_DETAILS } from '@/lib/constants';

export const StrovynV2ConsultationCta: React.FC = () => {
  return (
    <section
      id="v2-consultation"
      aria-label="Request an Architectural Painting Consultation"
      className="w-full bg-[#C41E1E] text-white py-20 md:py-28"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-14 items-start">
          {/* Left 6 Columns: Bold Brand Red Architectural Invitation */}
          <div className="lg:col-span-6 space-y-6">
            <span className="font-mono text-xs uppercase tracking-[0.26em] text-white/85 block">
              [ 05 / COMMENCE YOUR COMMISSION ]
            </span>

            <h2 className="type-hero uppercase text-5xl sm:text-6xl lg:text-[4.75rem] leading-[0.94] text-white">
              <span className="block">Arrange An</span>
              <span className="block">On-Site Scope</span>
              <span className="block text-stroke-white">Assessment.</span>
            </h2>

            <p className="font-sans text-sm sm:text-base text-white/92 max-w-lg leading-relaxed">
              Share your property suburb and scope requirements to schedule an on-site substrate
              evaluation and written itemised quotation across Greater Adelaide.
            </p>

            <div className="pt-4 border-t border-white/25 flex flex-col sm:flex-row sm:items-center gap-4">
              <a
                href={WHATSAPP_DETAILS.chatUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 bg-[#141513] hover:bg-black text-white px-5 py-3.5 font-mono text-xs uppercase tracking-[0.18em] transition-colors"
              >
                <MessageCircle className="h-4 w-4 text-[#8EE0AD]" aria-hidden="true" />
                <span>WhatsApp {WHATSAPP_DETAILS.internationalDisplay}</span>
              </a>

              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 border border-white/55 hover:bg-white hover:text-[#20211F] text-white px-5 py-3.5 font-mono text-xs uppercase tracking-[0.18em] transition-colors"
              >
                <span>Attach Plans on /contact</span>
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>

          {/* Right 6 Columns: Direct Consultation Brief Handoff Form (routes cleanly to existing /contact) */}
          <div className="lg:col-span-6 bg-[#181917] text-[#F4F1EA] border border-white/20 p-7 sm:p-9 shadow-2xl">
            <div className="border-b border-white/12 pb-4 mb-6">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#C9B28F] block mb-1">
                CONSULTATION INTAKE
              </span>
              <h3 className="type-card-title text-2xl sm:text-3xl uppercase text-[#F4F1EA]">
                Prepare Your Project Brief
              </h3>
            </div>

            <form action="/contact" method="GET" className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="v2-quote-name"
                    className="block font-mono text-[10px] uppercase tracking-[0.16em] text-[#B8B5AE] mb-1.5"
                  >
                    Full Name *
                  </label>
                  <input
                    id="v2-quote-name"
                    name="name"
                    type="text"
                    required
                    placeholder="Your name"
                    className="w-full px-3.5 py-3 border border-white/20 bg-[#222320] text-sm font-sans text-white placeholder:text-[#A8A59E] focus:outline-none focus:border-[#C9B28F]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="v2-quote-location"
                    className="block font-mono text-[10px] uppercase tracking-[0.16em] text-[#B8B5AE] mb-1.5"
                  >
                    Adelaide Suburb
                  </label>
                  <input
                    id="v2-quote-location"
                    name="location"
                    type="text"
                    placeholder="e.g. North Adelaide, Unley"
                    className="w-full px-3.5 py-3 border border-white/20 bg-[#222320] text-sm font-sans text-white placeholder:text-[#A8A59E] focus:outline-none focus:border-[#C9B28F]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="v2-quote-email"
                    className="block font-mono text-[10px] uppercase tracking-[0.16em] text-[#B8B5AE] mb-1.5"
                  >
                    Email Address *
                  </label>
                  <input
                    id="v2-quote-email"
                    name="email"
                    type="email"
                    required
                    placeholder="you@example.com"
                    className="w-full px-3.5 py-3 border border-white/20 bg-[#222320] text-sm font-sans text-white placeholder:text-[#A8A59E] focus:outline-none focus:border-[#C9B28F]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="v2-quote-phone"
                    className="block font-mono text-[10px] uppercase tracking-[0.16em] text-[#B8B5AE] mb-1.5"
                  >
                    Phone Number
                  </label>
                  <input
                    id="v2-quote-phone"
                    name="phone"
                    type="tel"
                    placeholder="0400 000 000"
                    className="w-full px-3.5 py-3 border border-white/20 bg-[#222320] text-sm font-sans text-white placeholder:text-[#A8A59E] focus:outline-none focus:border-[#C9B28F]"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="v2-quote-service"
                  className="block font-mono text-[10px] uppercase tracking-[0.16em] text-[#B8B5AE] mb-1.5"
                >
                  Primary Discipline
                </label>
                <select
                  id="v2-quote-service"
                  name="service"
                  defaultValue="Interior Precision Painting"
                  className="w-full px-3.5 py-3 border border-white/20 bg-[#222320] text-sm font-sans text-white focus:outline-none focus:border-[#C9B28F]"
                >
                  <option value="Interior Precision Painting">Interior Architectural Painting</option>
                  <option value="Exterior Cladding & Facade Protection">Exterior Facade Restoration &amp; Coatings</option>
                  <option value="Cabinet Refinishing & Spraying">Fine Cabinetry &amp; Millwork Lacquering</option>
                  <option value="Woodwork & Architectural Trim">Artisanal Plasters &amp; Architectural Trim</option>
                  <option value="Commercial & Heritage Painting">Commercial &amp; Heritage Conservation</option>
                </select>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-4 px-6 bg-[#F4F1EA] hover:bg-[#C9B28F] text-[#141513] font-mono text-xs uppercase tracking-[0.22em] font-semibold transition-colors cursor-pointer"
              >
                Continue To Consultation Portal &rarr;
              </button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};
