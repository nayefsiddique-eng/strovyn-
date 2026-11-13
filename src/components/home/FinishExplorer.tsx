'use client';

import React, { useState } from 'react';

interface PaletteOption {
  name: string;
  category: 'Architectural Mineral' | 'Warm Editorial' | 'Heritage Limewash';
  hex: string;
  sheen: string;
  recommendedSubstrate: string;
  lightingBehavior: string;
}

const PALETTES: PaletteOption[] = [
  {
    name: 'Warm Ivory Mineral',
    category: 'Architectural Mineral',
    hex: '#F4F1EA',
    sheen: 'Deep Velvet Matte (3%)',
    recommendedSubstrate: 'Ceilings & Double-Height Living Pavilions',
    lightingBehavior: 'Diffuses raking low-angle daylight softly without planar glare or flashing.',
  },
  {
    name: 'Raw Limestone Chalk',
    category: 'Heritage Limewash',
    hex: '#EBE7DF',
    sheen: 'Dead Flat (1%)',
    recommendedSubstrate: 'Internal Masonry, Bluestone, & Sandstone Accents',
    lightingBehavior: 'Absorbs ambient light naturally, offering subtle chalky micro-mottling.',
  },
  {
    name: 'Muted Bronze Ochre',
    category: 'Warm Editorial',
    hex: '#A78B65',
    sheen: 'Low-Sheen Eggshell (8%)',
    recommendedSubstrate: 'Dining Alcoves, Study Joinery & Feature Niches',
    lightingBehavior: 'Develops deep, intimate warmth under evening 2700K incandescent illumination.',
  },
  {
    name: 'Deep Architectural Charcoal',
    category: 'Architectural Mineral',
    hex: '#20211F',
    sheen: 'Satin Finish (20%)',
    recommendedSubstrate: 'Architectural Millwork, Doors, Window Reveals',
    lightingBehavior: 'Provides grounding contrast against pale timber and raw natural stones.',
  },
  {
    name: 'Adelaide Hills Slate',
    category: 'Warm Editorial',
    hex: '#7A7D79',
    sheen: 'Velvet Low-Sheen (6%)',
    recommendedSubstrate: 'Master Suites & Feature Wall Transitions',
    lightingBehavior: 'Subtly shifts between warm olive and cool slate across the diurnal cycle.',
  },
];

export const FinishExplorer: React.FC = () => {
  const [selected, setSelected] = useState<PaletteOption>(PALETTES[0]);

  return (
    <section aria-label="Colour and Finish Explorer" className="py-20 md:py-28 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto border-b border-warm-grey/30">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
        {/* Left Column: Explorer Details */}
        <div className="lg:col-span-5 space-y-6">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block">
            [ 02 / COLOUR AS CRAFT ]
          </span>
          <h2 className="font-serif text-3xl sm:text-4xl text-charcoal leading-tight">
            Curated Colour &amp; Finish Explorer
          </h2>
          <p className="font-sans text-base text-charcoal/80 leading-relaxed">
            Colour is treated as an architectural material, not a commodity. Explore our curated mineral pigments and low-sheen sheens formulated to interact harmoniously with natural daylight.
          </p>

          <div className="space-y-2 pt-2">
            <span className="font-mono text-xs uppercase text-warm-grey-dark tracking-wider block">
              SELECT FINISH FORMULATION:
            </span>
            <div className="flex flex-wrap gap-2">
              {PALETTES.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSelected(item)}
                  className={`flex items-center gap-2.5 px-3.5 py-2 border text-xs font-sans transition-all cursor-pointer ${
                    selected.name === item.name
                      ? 'bg-charcoal text-white border-charcoal'
                      : 'bg-white text-charcoal/80 border-warm-grey/30 hover:border-bronze'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 border border-black/10 inline-block"
                    style={{ backgroundColor: item.hex }}
                  />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Swatch Display */}
        <div className="lg:col-span-7 bg-white border border-warm-grey/30 p-8 sm:p-10 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b border-warm-grey/20 pb-4">
            <div>
              <span className="font-mono text-xs text-bronze uppercase tracking-widest block">
                {selected.category}
              </span>
              <h3 className="font-serif text-2xl text-charcoal mt-1">{selected.name}</h3>
            </div>
            <span className="font-mono text-xs bg-ivory px-3 py-1 border border-warm-grey/30 text-charcoal font-medium">
              HEX {selected.hex}
            </span>
          </div>

          {/* Color & Texture Preview Swatch */}
          <div
            className="w-full h-44 sm:h-52 border border-warm-grey/40 relative shadow-inner flex items-end p-6 transition-colors duration-500"
            style={{ backgroundColor: selected.hex }}
          >
            <div className="bg-white/95 backdrop-blur-sm p-3 text-xs border border-black/10 font-mono text-charcoal">
              Calibrated Sheen: {selected.sheen}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
            <div className="p-4 bg-ivory border border-warm-grey/20">
              <span className="font-sans uppercase text-warm-grey-dark block mb-1 font-medium">
                Target Substrate
              </span>
              <p className="font-sans text-charcoal/85 leading-relaxed">
                {selected.recommendedSubstrate}
              </p>
            </div>
            <div className="p-4 bg-ivory border border-warm-grey/20">
              <span className="font-sans uppercase text-warm-grey-dark block mb-1 font-medium">
                Daylight Interaction
              </span>
              <p className="font-sans text-charcoal/85 leading-relaxed">
                {selected.lightingBehavior}
              </p>
            </div>
          </div>

          {/* Disclaimer regarding real-world variance */}
          <div className="pt-2 text-[10px] text-warm-grey-dark italic border-t border-warm-grey/20">
            * Please Note: Digital on-screen colour and sheen representations may vary from actual painted finishes due to individual device display profiles, room orientation, and in-situ substrate porosity. Physical drawdown swatches are verified during our free on-site Adelaide consultation.
          </div>
        </div>
      </div>
    </section>
  );
};
