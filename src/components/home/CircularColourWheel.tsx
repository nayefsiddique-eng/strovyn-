'use client';

import React, { useRef } from 'react';

export interface WheelColour {
  id: string;
  name: string;
  hex: string;
  family: string;
  description: string;
}

export const ARCHITECTURAL_WHEEL_COLOURS: WheelColour[] = [
  {
    id: 'warm-ivory-mineral',
    name: 'Warm Ivory Mineral',
    hex: '#F4F1EA',
    family: 'Limestone & Ivory',
    description: 'Soft mineral warmth that opens architectural volume under raking daylight.',
  },
  {
    id: 'raw-limestone-chalk',
    name: 'Raw Limestone Chalk',
    hex: '#EBE7DF',
    family: 'Limestone & Ivory',
    description: 'Velvety chalked neutral calibrated for gallery-grade plaster walls.',
  },
  {
    id: 'pale-travertine',
    name: 'Pale Travertine',
    hex: '#DDD4C4',
    family: 'Warm Neutrals',
    description: 'Sun-washed stone tone balancing crisp shadow lines and natural timber.',
  },
  {
    id: 'warm-sand-plaster',
    name: 'Warm Sand Plaster',
    hex: '#C9B79C',
    family: 'Warm Neutrals',
    description: 'Tactile coastal sand pigment with subtle warm mineral depth.',
  },
  {
    id: 'muted-bronze-ochre',
    name: 'Muted Bronze Ochre',
    hex: '#A78B65',
    family: 'Earth & Ochre',
    description: 'Architectural bronze-earth finish that glows under 2700K evening light.',
  },
  {
    id: 'terracotta-clay',
    name: 'Terracotta Clay',
    hex: '#8E5A42',
    family: 'Earth & Ochre',
    description: 'Rich baked clay pigment suited to feature niches and warm masonry.',
  },
  {
    id: 'burnt-umber-earth',
    name: 'Burnt Umber Earth',
    hex: '#5E4032',
    family: 'Earth & Ochre',
    description: 'Grounded roasted umber adding intimate architectural weight.',
  },
  {
    id: 'deep-architectural-charcoal',
    name: 'Deep Architectural Charcoal',
    hex: '#20211F',
    family: 'Charcoal & Basalt',
    description: 'Low-LRV obsidian charcoal engineered for crisp recessed reveals.',
  },
  {
    id: 'obsidian-basalt',
    name: 'Obsidian Basalt',
    hex: '#343633',
    family: 'Charcoal & Basalt',
    description: 'Smoked volcanic grey with refined specular control in raking light.',
  },
  {
    id: 'coastal-eucalyptus',
    name: 'Coastal Eucalyptus',
    hex: '#6D776A',
    family: 'Sage & Slate',
    description: 'Muted Australian foliage grey-green harmonising with stone and steel.',
  },
  {
    id: 'adelaide-hills-slate',
    name: 'Adelaide Hills Slate',
    hex: '#7A7D79',
    family: 'Sage & Slate',
    description: 'Balanced mid-tone slate neutral for contemporary residential facades.',
  },
  {
    id: 'silvered-limestone',
    name: 'Silvered Limestone',
    hex: '#B8B5AC',
    family: 'Sage & Slate',
    description: 'Cool mineral stone bridging warm interiors and exterior concrete.',
  },
];

function polarToCartesian(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(rad),
    y: cy + radius * Math.sin(rad),
  };
}

function createWedgePath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number
): string {
  const outerStart = polarToCartesian(cx, cy, outerR, startDeg);
  const outerEnd = polarToCartesian(cx, cy, outerR, endDeg);
  const innerEnd = polarToCartesian(cx, cy, innerR, endDeg);
  const innerStart = polarToCartesian(cx, cy, innerR, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

function isLightHex(hex: string): boolean {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62;
}

export interface CircularColourWheelProps {
  colours?: WheelColour[];
  activeId: string;
  onSelect: (colour: WheelColour) => void;
  className?: string;
}

export const CircularColourWheel: React.FC<CircularColourWheelProps> = ({
  colours = ARCHITECTURAL_WHEEL_COLOURS,
  activeId,
  onSelect,
  className = '',
}) => {
  const segmentRefs = useRef<(SVGPathElement | null)[]>([]);
  const total = colours.length;
  const activeIndex = Math.max(
    0,
    colours.findIndex((c) => c.id === activeId)
  );
  const activeColour = colours[activeIndex] ?? colours[0];
  const centerLight = isLightHex(activeColour.hex);

  const cx = 180;
  const cy = 180;
  const innerR = 104;
  const outerR = 164;
  const stepDeg = 360 / total;
  const gapDeg = 1.6;

  const selectByIndex = (nextIdx: number, moveFocus = false) => {
    const normalized = ((nextIdx % total) + total) % total;
    onSelect(colours[normalized]);
    if (moveFocus) {
      requestAnimationFrame(() => {
        segmentRefs.current[normalized]?.focus();
      });
    }
  };

  const handleSegmentKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      selectByIndex(idx + 1, true);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      selectByIndex(idx - 1, true);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      selectByIndex(idx, false);
    }
  };

  // Position of active marker dot on the inner rim of the active segment
  const activeMidDeg = activeIndex * stepDeg + stepDeg / 2;
  const indicatorPos = polarToCartesian(cx, cy, innerR + 6, activeMidDeg);

  return (
    <div className={`relative mx-auto w-full max-w-[330px] sm:max-w-[360px] select-none ${className}`}>
      <div className="relative aspect-square w-full">
        <svg
          viewBox="0 0 360 360"
          role="radiogroup"
          aria-label="Interactive architectural colour wheel"
          className="w-full h-full overflow-visible drop-shadow-xl"
        >
          {/* Subtle outer hairline ring */}
          <circle
            cx={cx}
            cy={cy}
            r={outerR + 6}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.18}
            strokeWidth={1}
          />

          {/* 12 Curated Colour Segments */}
          {colours.map((colour, idx) => {
            const startDeg = idx * stepDeg + gapDeg / 2;
            const endDeg = (idx + 1) * stepDeg - gapDeg / 2;
            const isSelected = colour.id === activeColour.id;
            const pathD = createWedgePath(
              cx,
              cy,
              isSelected ? innerR - 3 : innerR,
              isSelected ? outerR + 4 : outerR,
              startDeg,
              endDeg
            );

            return (
              <path
                key={colour.id}
                ref={(el) => {
                  segmentRefs.current[idx] = el;
                }}
                d={pathD}
                fill={colour.hex}
                stroke={isSelected ? '#FFFFFF' : 'rgba(20,21,19,0.28)'}
                strokeWidth={isSelected ? 2.5 : 1}
                role="radio"
                aria-checked={isSelected}
                aria-label={`${colour.name} (${colour.hex})`}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => selectByIndex(idx, false)}
                onKeyDown={(e) => handleSegmentKeyDown(e, idx)}
                className="cursor-pointer transition-opacity duration-200 motion-reduce:transition-none hover:opacity-95 focus:outline-none focus-visible:stroke-[#A78B65] focus-visible:stroke-[3]"
              >
                <title>{`${colour.name} · ${colour.hex}`}</title>
              </path>
            );
          })}

          {/* Inner ring frame */}
          <circle
            cx={cx}
            cy={cy}
            r={innerR - 4}
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth={1.25}
            pointerEvents="none"
          />

          {/* Active indicator dot */}
          <circle
            cx={indicatorPos.x}
            cy={indicatorPos.y}
            r={6}
            fill="#FFFFFF"
            stroke="#20211F"
            strokeWidth={2}
            pointerEvents="none"
          />
        </svg>

        {/* Central Circular Preview with Prev / Next Controls */}
        <div
          className="absolute inset-0 m-auto w-[50%] h-[50%] rounded-full shadow-inner border border-black/20 dark:border-white/25 flex flex-col items-center justify-center text-center px-3 transition-colors duration-300 motion-reduce:transition-none"
          style={{
            backgroundColor: activeColour.hex,
            backgroundImage:
              'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.22) 0%, rgba(0,0,0,0.12) 100%)',
          }}
        >
          <div className="flex items-center justify-between w-full gap-1">
            <button
              type="button"
              onClick={() => selectByIndex(activeIndex - 1, false)}
              aria-label="Previous architectural colour"
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze ${
                centerLight
                  ? 'bg-black/10 hover:bg-black/20 text-charcoal'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>

            <div className="min-w-0 flex-1 px-1">
              <p
                className={`font-sans text-[11px] sm:text-xs font-semibold leading-tight line-clamp-2 ${
                  centerLight ? 'text-charcoal' : 'text-white'
                }`}
              >
                {activeColour.name}
              </p>
              <p
                className={`mt-1 font-mono text-[10px] uppercase tracking-[0.16em] ${
                  centerLight ? 'text-charcoal/75' : 'text-white/80'
                }`}
              >
                {activeColour.hex}
              </p>
            </div>

            <button
              type="button"
              onClick={() => selectByIndex(activeIndex + 1, false)}
              aria-label="Next architectural colour"
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze ${
                centerLight
                  ? 'bg-black/10 hover:bg-black/20 text-charcoal'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Pagination indicator dots */}
      <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden="true">
        {colours.map((c, idx) => (
          <span
            key={c.id}
            className={`h-1.5 rounded-full transition-all duration-200 motion-reduce:transition-none ${
              idx === activeIndex ? 'w-4 bg-bronze' : 'w-1.5 bg-warm-grey/40 dark:bg-white/20'
            }`}
          />
        ))}
      </div>
    </div>
  );
};
