'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { WHATSAPP_DETAILS } from '@/lib/constants';

const WhatsAppGlyph: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg
    className={`${className} fill-current`}
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
  </svg>
);

/**
 * FloatingContact — Coordinated bottom-right WhatsApp channel on md+ screens
 * (paired cleanly beneath STRO) and docked sticky action bar on < 768px phones.
 */
export const FloatingContact: React.FC = () => {
  const [labelVisible, setLabelVisible] = useState(false);

  const whatsappHref = `${WHATSAPP_DETAILS.chatUrl}?text=${WHATSAPP_DETAILS.defaultEnquiryMessage}`;

  return (
    <>
      {/* Desktop & Tablet Floating WhatsApp Control (Bottom Right anchor below STRO) */}
      <aside
        aria-label="WhatsApp Direct Contact"
        data-floating-whatsapp="true"
        className="fixed bottom-5 right-5 z-40 hidden md:flex items-center gap-3 font-sans"
      >
        <span
          className={`absolute bottom-14 right-0 px-3 py-1.5 text-[11px] font-mono uppercase tracking-[0.16em] bg-ivory-light dark:bg-[#1E1F1D] text-charcoal dark:text-[#F4F1EA] border border-warm-grey/50 dark:border-white/15 shadow-md pointer-events-none transition-all duration-200 whitespace-nowrap ${
            labelVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
          }`}
          aria-hidden="true"
        >
          WhatsApp &middot; {WHATSAPP_DETAILS.displayNumber}
        </span>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          onMouseEnter={() => setLabelVisible(true)}
          onMouseLeave={() => setLabelVisible(false)}
          onFocus={() => setLabelVisible(true)}
          onBlur={() => setLabelVisible(false)}
          aria-label={`Chat with Strovyn on WhatsApp (${WHATSAPP_DETAILS.displayNumber})`}
          className="h-11 w-11 rounded-full bg-[#1B8A4B] hover:bg-[#16733E] text-white flex items-center justify-center shadow-[0_10px_28px_-6px_rgba(0,0,0,0.35)] hover:shadow-[0_14px_34px_-6px_rgba(0,0,0,0.45)] border border-white/25 dark:border-white/15 transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze focus-visible:ring-offset-2"
        >
          <WhatsAppGlyph className="w-5 h-5" />
        </a>
      </aside>

      {/* Mobile Sticky Contact Bar (Phones < 768px) */}
      <nav
        aria-label="Mobile Contact Bar"
        data-mobile-contact-bar="true"
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-ivory-light/95 dark:bg-[#181917]/95 backdrop-blur-md border-t border-warm-grey/40 dark:border-white/15 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex items-center justify-between gap-2 shadow-lg"
      >
        <Link
          href="/contact"
          className="flex-1 py-2.5 px-3 bg-bronze hover:bg-bronze-hover text-white text-center font-sans text-xs uppercase tracking-wider font-medium flex items-center justify-center gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
        >
          <FileText size={14} aria-hidden="true" />
          <span>Request a Quote</span>
        </Link>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="py-2.5 px-4 bg-[#1B7A43] hover:bg-[#156336] text-white flex items-center justify-center gap-2 font-sans text-xs uppercase tracking-wider font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
          aria-label="Chat with Strovyn on WhatsApp"
        >
          <WhatsAppGlyph className="w-4 h-4" />
          <span>WhatsApp</span>
        </a>
      </nav>
    </>
  );
};

export default FloatingContact;
