'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  CircularColourWheel,
  ARCHITECTURAL_WHEEL_COLOURS,
  type WheelColour,
} from './CircularColourWheel';

const ArchitecturalSurfaceStudio = dynamic(
  () => import('@/components/three/ArchitecturalSurfaceStudio'),
  {
    ssr: false,
    loading: () => (
      <div
        aria-hidden="true"
        className="w-full h-full min-h-[240px] bg-gradient-to-br from-[#F4F1EA] to-[#E5DFD3] dark:from-[#20211F] dark:to-[#141513] animate-pulse"
      />
    ),
  }
);

export interface FinishOption {
  id: 'smooth-matt' | 'limewash' | 'textured-plaster' | 'satin';
  label: string;
  category: 'Architectural Mineral' | 'Warm Editorial' | 'Artisanal Limewash';
  sheenLabel: string;
  textureStyle: string;
}

const FINISH_OPTIONS: FinishOption[] = [
  {
    id: 'smooth-matt',
    label: 'Smooth Matt',
    category: 'Architectural Mineral',
    sheenLabel: 'Smooth Matt (2% Sheen)',
    textureStyle: 'radial-gradient(circle at 30% 30%, rgba(255,255,255,0.14), rgba(0,0,0,0.06))',
  },
  {
    id: 'limewash',
    label: 'Limewash',
    category: 'Artisanal Limewash',
    sheenLabel: 'Artisanal Limewash (Mineral Matte)',
    textureStyle:
      'repeating-linear-gradient(125deg, rgba(255,255,255,0.16) 0px, rgba(255,255,255,0.02) 8px, rgba(0,0,0,0.08) 16px)',
  },
  {
    id: 'textured-plaster',
    label: 'Textured Plaster',
    category: 'Warm Editorial',
    sheenLabel: 'Textured Plaster (Hand-Trowelled)',
    textureStyle:
      'repeating-linear-gradient(35deg, rgba(255,255,255,0.18) 0px, rgba(0,0,0,0.1) 6px, rgba(255,255,255,0.08) 12px)',
  },
  {
    id: 'satin',
    label: 'Satin',
    category: 'Architectural Mineral',
    sheenLabel: 'Architectural Satin (18% Sheen)',
    textureStyle:
      'linear-gradient(135deg, rgba(255,255,255,0.34) 0%, rgba(255,255,255,0.06) 55%, rgba(0,0,0,0.08) 100%)',
  },
];

const DEFAULT_COLOUR = ARCHITECTURAL_WHEEL_COLOURS[0];
const DEFAULT_FINISH = FINISH_OPTIONS[0];
const DEFAULT_LIGHT_ANGLE = 42;
const DEFAULT_LIGHT_TEMP: 'daylight' | 'warm' = 'daylight';

export const FinishExplorer: React.FC = () => {
  const [activeColour, setActiveColour] = useState<WheelColour>(DEFAULT_COLOUR);
  const [activeFinish, setActiveFinish] = useState<FinishOption>(DEFAULT_FINISH);
  const [lightAngleDeg, setLightAngleDeg] = useState<number>(DEFAULT_LIGHT_ANGLE);
  const [lightTemp, setLightTemp] = useState<'daylight' | 'warm'>(DEFAULT_LIGHT_TEMP);
  const [resetTrigger, setResetTrigger] = useState<number>(0);

  const handleReset = () => {
    setActiveColour(DEFAULT_COLOUR);
    setActiveFinish(DEFAULT_FINISH);
    setLightAngleDeg(DEFAULT_LIGHT_ANGLE);
    setLightTemp(DEFAULT_LIGHT_TEMP);
    setResetTrigger((prev) => prev + 1);
  };

  return (
    <section
      id="finish-studio"
      aria-labelledby="finish-studio-heading"
      className="relative bg-ivory dark:bg-[#1C1A17] text-charcoal dark:text-[#F4F1EA] border-t border-warm-grey/30 dark:border-white/10 py-16 md:py-24 overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left Column: Editorial Intro & Studio CTAs */}
          <div className="lg:col-span-4 space-y-6">
            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-bronze dark:text-[#C9B28F]">
                THE FINISH STUDIO
              </p>
              <h2
                id="finish-studio-heading"
                className="font-display font-normal text-4xl sm:text-5xl lg:text-[3.4rem] leading-[0.95] tracking-tight uppercase text-charcoal dark:text-white"
              >
                EXPLORE COLOURS &amp; FINISHES
              </h2>
            </div>

            <p className="font-sans text-sm sm:text-base leading-relaxed text-charcoal/75 dark:text-[#D5D0C7] max-w-md">
              A curated palette of architectural colours and premium finishes. Select a
              colour on the wheel to inspect its tone, sheen, and raking-light response in
              real time.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <Link
                href={`/visualiser?color=${encodeURIComponent(activeColour.hex)}&finish=${encodeURIComponent(activeColour.name)}`}
                className="inline-flex items-center justify-center gap-2 bg-bronze hover:bg-bronze/90 text-white px-5 py-3 font-mono text-xs uppercase tracking-[0.16em] font-semibold transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
              >
                <span>Browse All Finishes</span>
                <span aria-hidden="true">&rarr;</span>
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 border border-charcoal/30 dark:border-white/25 hover:border-bronze px-5 py-3 font-mono text-xs uppercase tracking-[0.16em] text-charcoal dark:text-[#F4F1EA] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze"
              >
                <span>Request Sample Board</span>
              </Link>
            </div>

            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-warm-grey-dark dark:text-[#9A958B]">
              Illustrative finish &amp; colour studio — physical sample boards calibrated on site.
            </p>
          </div>

          {/* Center Column: Interactive 12-Segment SVG Circular Colour Wheel */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center">
            <CircularColourWheel
              colours={ARCHITECTURAL_WHEEL_COLOURS}
              activeId={activeColour.id}
              onSelect={setActiveColour}
            />
          </div>

          {/* Right Column: Live Selection Details, Finish Options, 3D Material Studio & Lighting Controls */}
          <div className="lg:col-span-4 space-y-5">
            {/* Active Colour Header */}
            <div className="border-b border-warm-grey/30 dark:border-white/10 pb-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bronze dark:text-[#C9B28F]">
                    {activeColour.family}
                  </span>
                  <h3 className="font-display font-normal text-2xl sm:text-3xl tracking-tight uppercase text-charcoal dark:text-white mt-0.5">
                    {activeColour.name}
                  </h3>
                </div>
                <span className="font-mono text-xs uppercase tracking-[0.16em] px-2.5 py-1 bg-charcoal/5 dark:bg-white/10 border border-warm-grey/30 dark:border-white/15 text-charcoal dark:text-[#F4F1EA] shrink-0">
                  {activeColour.hex}
                </span>
              </div>
              <p className="mt-2 font-sans text-xs sm:text-sm leading-relaxed text-charcoal/75 dark:text-[#CFCAC0]">
                {activeColour.description}
              </p>
            </div>

            {/* Available Finishes (Smooth Matt, Limewash, Textured Plaster, Satin) */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-warm-grey-dark dark:text-[#A8A59E]">
                  AVAILABLE FINISHES
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-bronze dark:text-[#C9B28F]">
                  {activeFinish.sheenLabel}
                </span>
              </div>
              <div
                role="radiogroup"
                aria-label="Select architectural finish type"
                className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-2"
              >
                {FINISH_OPTIONS.map((finish) => {
                  const isSelected = finish.id === activeFinish.id;
                  return (
                    <button
                      key={finish.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setActiveFinish(finish)}
                      className={`group flex flex-col items-center gap-1.5 p-2 border text-center transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze ${
                        isSelected
                          ? 'border-bronze bg-charcoal text-white dark:bg-[#F4F1EA] dark:text-charcoal shadow-sm'
                          : 'border-warm-grey/35 dark:border-white/15 bg-white/70 dark:bg-[#26231F] text-charcoal dark:text-[#F4F1EA] hover:border-bronze'
                      }`}
                    >
                      <span
                        className="w-full h-7 border border-black/15 dark:border-white/15 block"
                        style={{
                          backgroundColor: activeColour.hex,
                          backgroundImage: finish.textureStyle,
                        }}
                        aria-hidden="true"
                      />
                      <span className="font-mono text-[10px] uppercase tracking-wider leading-tight">
                        {finish.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live 3D Architectural Surface Studio Viewport */}
            <div className="relative h-[220px] sm:h-[245px] border border-warm-grey/40 dark:border-white/15 bg-[#EBE7DF] dark:bg-[#141513] overflow-hidden shadow-md">
              <ArchitecturalSurfaceStudio
                colorHex={activeColour.hex}
                finishName={activeColour.name}
                category={activeFinish.category}
                sheenLabel={activeFinish.sheenLabel}
                lightAngleDeg={lightAngleDeg}
                lightTemp={lightTemp}
                resetTrigger={resetTrigger}
              />
            </div>

            {/* Raking Light Angle, Colour Temperature & Reset Controls */}
            <div className="bg-white/80 dark:bg-[#23201C] border border-warm-grey/35 dark:border-white/15 p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="finish-raking-light-angle"
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-charcoal/80 dark:text-[#D5D0C7]"
                >
                  Raking Light Angle
                </label>
                <span className="font-mono text-[11px] text-bronze dark:text-[#C9B28F] font-semibold">
                  {lightAngleDeg}°
                </span>
              </div>
              <input
                id="finish-raking-light-angle"
                type="range"
                min={15}
                max={165}
                step={1}
                value={lightAngleDeg}
                onChange={(e) => setLightAngleDeg(Number(e.target.value))}
                className="w-full accent-[#A78B65] cursor-pointer"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1.5" role="group" aria-label="Lighting colour temperature">
                  <button
                    type="button"
                    onClick={() => setLightTemp('daylight')}
                    aria-pressed={lightTemp === 'daylight'}
                    className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider border transition-colors cursor-pointer ${
                      lightTemp === 'daylight'
                        ? 'bg-charcoal text-white border-charcoal dark:bg-[#F4F1EA] dark:text-charcoal dark:border-[#F4F1EA]'
                        : 'bg-transparent text-charcoal/80 dark:text-[#D5D0C7] border-warm-grey/40 dark:border-white/15 hover:border-bronze'
                    }`}
                  >
                    5500K Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setLightTemp('warm')}
                    aria-pressed={lightTemp === 'warm'}
                    className={`px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider border transition-colors cursor-pointer ${
                      lightTemp === 'warm'
                        ? 'bg-charcoal text-white border-charcoal dark:bg-[#F4F1EA] dark:text-charcoal dark:border-[#F4F1EA]'
                        : 'bg-transparent text-charcoal/80 dark:text-[#D5D0C7] border-warm-grey/40 dark:border-white/15 hover:border-bronze'
                    }`}
                  >
                    2700K Warm
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleReset}
                  className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider border border-warm-grey/40 dark:border-white/15 text-charcoal/80 dark:text-[#D5D0C7] hover:border-brand-red hover:text-brand-red transition-colors cursor-pointer"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
