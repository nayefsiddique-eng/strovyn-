'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { MessageCircle, FileText, X } from 'lucide-react';
import { WHATSAPP_DETAILS } from '@/lib/constants';

export const FloatingContact: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <>
      {/* Desktop & Tablet Floating WhatsApp Control (Bottom Right) */}
      <aside
        aria-label="WhatsApp & Direct Enquiries"
        className="fixed bottom-6 right-6 z-40 hidden md:flex items-center gap-3 font-sans"
      >
        {/* Tooltip on Hover: "Chat with Strovyn" */}
        {hovered && !open && (
          <div className="bg-[#181917] text-white border border-bronze/40 px-3 py-1.5 shadow-xl text-xs font-mono uppercase tracking-wider animate-in fade-in slide-in-from-right-1 pointer-events-none">
            Chat with Strovyn
          </div>
        )}

        {/* Circular WhatsApp Floating Button with Official Icon & Strovyn Accent */}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          className="relative w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-105 cursor-pointer ring-4 ring-emerald-950/30"
          aria-label="Chat with Strovyn on WhatsApp"
        >
          {/* Official Recognizable WhatsApp SVG Vector */}
          <svg
            className="w-7 h-7 text-white fill-current"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
          </svg>
          {/* Strovyn Signature Red Accent Badge */}
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-brand-red rounded-full border-2 border-white" />
        </button>

        {/* Quick Contact Drawer */}
        {open && (
          <div className="absolute bottom-18 right-0 bg-[#1A1B19] text-white border border-warm-grey/30 p-5 shadow-2xl flex flex-col gap-3 min-w-[280px] animate-in fade-in slide-in-from-bottom-2">
            <div className="flex items-center justify-between border-b border-white/15 pb-2">
              <span className="font-mono text-[10px] uppercase text-bronze tracking-widest font-semibold">
                ADELAIDE DIRECT ENQUIRIES
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-warm-grey hover:text-white transition-colors cursor-pointer"
                aria-label="Close tray"
              >
                <X size={14} />
              </button>
            </div>

            <a
              href="https://wa.me/61406646061?text=Hello%20Strovyn%20Painting%20Co.%20I%20would%20like%20to%20enquire%20about%20a%20painting%20project%20in%20Adelaide."
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 bg-emerald-700 hover:bg-emerald-600 transition-colors text-xs text-white border border-emerald-500/40"
            >
              <MessageCircle size={18} className="text-white flex-shrink-0" />
              <div>
                <span className="font-medium block">Chat on WhatsApp</span>
                <span className="text-[11px] text-emerald-100 block font-mono">0406 646 061</span>
              </div>
            </a>

            <Link
              href="/contact"
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 p-3 bg-bronze hover:bg-bronze-hover transition-colors text-xs text-white"
            >
              <FileText size={18} className="text-white flex-shrink-0" />
              <div>
                <span className="font-medium block">Request a Quote</span>
                <span className="text-[10px] text-white/80 block">Free Adelaide On-Site Consultation</span>
              </div>
            </Link>

            <div className="pt-2 border-t border-white/10 text-[10px] text-warm-grey-dark text-center font-mono">
              Adelaide, South Australia<br />Mon–Sat 7:00 AM – 5:00 PM ACST
            </div>
          </div>
        )}
      </aside>

      {/* Mobile Sticky Contact Bar (Phones) */}
      <nav aria-label="Mobile Contact Bar" className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-[#181917]/95 backdrop-blur-md border-t border-white/15 px-3 py-2 flex items-center justify-between gap-2 shadow-2xl">
        <Link
          href="/contact"
          className="flex-1 py-2.5 px-3 bg-bronze text-white text-center font-sans text-xs uppercase tracking-wider font-medium flex items-center justify-center gap-2"
        >
          <FileText size={14} />
          <span>Request a Quote</span>
        </Link>

        <a
          href="https://wa.me/61406646061?text=Hello%20Strovyn%20Painting%20Co.%20I%20would%20like%20to%20enquire%20about%20a%20painting%20project%20in%20Adelaide."
          target="_blank"
          rel="noopener noreferrer"
          className="py-2.5 px-4 bg-emerald-600 text-white flex items-center justify-center gap-1.5 font-sans text-xs uppercase tracking-wider font-medium"
          aria-label="Chat on WhatsApp"
        >
          <MessageCircle size={15} />
          <span>WhatsApp</span>
        </a>
      </nav>
    </>
  );
};

export default FloatingContact;
