'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export interface FinalCTAProps {
  className?: string;
  quoteHref?: string;
  phoneHref?: string;
  phoneNumber?: string;
}

export const FinalCTA: React.FC<FinalCTAProps> = ({
  className,
  quoteHref = '/contact',
  phoneHref = 'tel:+61406646061',
  phoneNumber = '0406 646 061',
}) => {
  return (
    <section
      id="commence-project"
      aria-label="Commence a Project"
      className={cn(
        'relative w-full bg-charcoal text-white border-t border-warm-grey/30 py-24 md:py-32 lg:py-40 overflow-hidden',
        className
      )}
    >
      {/* Background Subtle Drafting Grid */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, #B8B5AE 1px, transparent 1px),
            linear-gradient(to bottom, #B8B5AE 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
        aria-hidden="true"
      />

      {/* Warm bronze ambient glow in background corner */}
      <div
        className="absolute -top-32 right-0 w-[500px] h-[500px] rounded-none opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(167, 139, 101, 0.4) 0%, rgba(32, 33, 31, 0) 70%)',
        }}
        aria-hidden="true"
      />

      <div className="relative max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Main Content Area */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.25, 1, 0.5, 1] }}
            className="lg:col-span-8"
          >
            {/* Eyebrow */}
            <div className="flex items-center gap-3 mb-6">
              <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium">
                [ 07 / CONSULTATION &amp; SPECIFICATION ]
              </span>
              <span className="w-12 h-[1px] bg-bronze/60" />
            </div>

            {/* Headline */}
            <h2 className="type-section-title text-3xl sm:text-5xl lg:text-6xl text-white mb-6">
              Ready to elevate your architectural vision?
            </h2>

            {/* Narrative */}
            <p className="font-sans text-base sm:text-lg text-warm-grey-light max-w-2xl leading-relaxed mb-10">
              Whether specifying finishes for a bespoke residential new build, landmark heritage restoration, or luxury commercial space, our estimators and coatings specialists provide comprehensive on-site consultations and finish sample kits.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <Button
                variant="primary"
                size="lg"
                href={quoteHref}
                rightIcon={
                  <svg
                    className="w-4 h-4 ml-1"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 8H13M13 8L8.5 3.5M13 8L8.5 12.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="square"
                    />
                  </svg>
                }
              >
                Request a Formal Quotation
              </Button>

              <Button
                variant="outline"
                size="lg"
                href={phoneHref}
                className="text-white border-white/40 hover:bg-white hover:text-charcoal hover:border-white"
                leftIcon={
                  <svg
                    className="w-4 h-4 mr-2"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="square"
                    aria-hidden="true"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                }
              >
                Speak With a Specialist
              </Button>
            </div>
          </motion.div>

          {/* Right Column: Specification Fast-Track Card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-80px' }}
            transition={{ duration: 0.7, ease: [0.25, 1, 0.5, 1], delay: 0.2 }}
            className="lg:col-span-4 border border-warm-grey/30 bg-[#272825] p-6 sm:p-8"
          >
            <div className="border-b border-warm-grey/30 pb-4 mb-6">
              <span className="font-mono text-[10px] text-bronze uppercase tracking-widest font-semibold block mb-1">
                [PROJECT INTAKE STANDARD]
              </span>
              <h3 className="type-card-title text-xl sm:text-2xl text-white">
                What to Expect Upon Engagement
              </h3>
            </div>

            <ul className="space-y-4 font-sans text-xs text-warm-grey-light">
              <li className="flex items-start gap-3">
                <span className="font-mono text-bronze font-semibold">01</span>
                <div>
                  <strong className="text-white block font-medium">Prompt Project Review</strong>
                  <span>Initial architectural plan &amp; scope review within 1 business day.</span>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="font-mono text-bronze font-semibold">02</span>
                <div>
                  <strong className="text-white block font-medium">On-Site Substrate Diagnostic</strong>
                  <span>Moisture equilibrium and raking light assessment across greater Adelaide.</span>
                </div>
              </li>

              <li className="flex items-start gap-3">
                <span className="font-mono text-bronze font-semibold">03</span>
                <div>
                  <strong className="text-white block font-medium">Physical Finish Drawdowns</strong>
                  <span>Physical 600×600mm sample panels delivered for client &amp; architect sign-off.</span>
                </div>
              </li>
            </ul>

            <div className="border-t border-warm-grey/30 pt-6 mt-6">
              <div className="flex items-center justify-between text-[11px] font-mono text-warm-grey">
                <span>DIRECT LINE:</span>
                <span className="text-bronze font-medium">{phoneNumber}</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Bottom Process Indicators Bar */}
        <div className="mt-16 pt-8 border-t border-warm-grey/20 flex flex-wrap items-center justify-between gap-6 text-xs font-mono text-warm-grey">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-bronze" />
            <span>LEVEL 5 RESIDENTIAL &amp; COMMERCIAL SPECIFICATIONS</span>
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

export default FinalCTA;
