'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { processStages } from '@/components/home/StrovynApproach';

const PROTOCOL_METRICS = [
  { code: 'WME < 12%', detail: 'Digital substrate moisture & alkalinity audit prior to priming' },
  { code: 'HEPA 99.97%', detail: 'Continuous dust-extracted sanding & sealed floor protection' },
  { code: '500+ LUMEN', detail: 'Directional raking-light planar inspection before topcoat' },
  { code: 'ARCHIVE KIT', detail: 'Recorded colour formulas & touch-up schedule at handover' },
] as const;

export const StrovynV2Approach: React.FC = () => {
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const activeStage = processStages[activeStageIdx] ?? processStages[0];

  return (
    <section
      id="v2-approach"
      aria-label="The Strovyn Four-Stage Architectural Approach"
      className="w-full bg-[#161715] text-[#F4F1EA] border-b border-white/12 py-20 md:py-28 lg:py-32"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12 space-y-14">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/15 pb-8">
          <div>
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#C9B28F] font-semibold block mb-3">
              [ 03 / EXECUTION METHODOLOGY ]
            </span>
            <h2 className="type-section-title text-3xl sm:text-5xl uppercase text-[#F4F1EA]">
              The Four-Stage Protocol.
            </h2>
          </div>

          <div className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#B8B5AE]">
            <span className="h-2 w-2 bg-[#C41E1E]" aria-hidden="true" />
            <span>Architect &amp; Builder Ready</span>
          </div>
        </div>

        {/* Structura-Inspired Interactive Stage Selector + Active Protocol Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
          {/* Left 5 Columns: Active Stage Deep-Dive */}
          <div className="lg:col-span-5 bg-[#20211F] border border-white/15 p-7 sm:p-9 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-white/12 pb-4">
                <span className="font-mono text-xs uppercase tracking-[0.22em] text-[#C9B28F]">
                  ACTIVE STAGE // {activeStage.number}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#B8B5AE]">
                  0{activeStageIdx + 1} OF 04
                </span>
              </div>

              <h3 className="type-section-title text-4xl sm:text-5xl uppercase text-[#F4F1EA] pt-2">
                {activeStage.title}.
              </h3>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#C9B28F]">
                {activeStage.subtitle}
              </p>
              <p className="font-sans text-sm sm:text-base text-[#D6D4CF] font-light leading-relaxed pt-2">
                {activeStage.description}
              </p>
            </div>

            <div className="pt-6 mt-8 border-t border-white/12">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#B8B5AE] block mb-1">
                Primary Verification Deliverable
              </span>
              <span className="font-mono text-xs sm:text-sm text-[#F4F1EA] font-medium">
                {activeStage.action}
              </span>
            </div>
          </div>

          {/* Right 7 Columns: 4 Interactive Architectural Rows */}
          <div className="lg:col-span-7 flex flex-col justify-between border-t border-white/15">
            {processStages.map((stage, idx) => {
              const isCurrent = idx === activeStageIdx;
              return (
                <motion.button
                  key={stage.number}
                  type="button"
                  onClick={() => setActiveStageIdx(idx)}
                  onMouseEnter={() => setActiveStageIdx(idx)}
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.45, delay: idx * 0.05 }}
                  className={`w-full text-left border-b border-white/15 py-6 px-4 sm:px-6 transition-colors cursor-pointer flex items-start justify-between gap-6 ${
                    isCurrent ? 'bg-[#20211F]' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-baseline gap-5">
                    <span
                      className={`font-mono text-xs tracking-[0.2em] ${
                        isCurrent ? 'text-[#C41E1E] font-semibold' : 'text-[#C9B28F]'
                      }`}
                    >
                      {stage.number}
                    </span>
                    <div>
                      <h4 className="type-card-title text-2xl uppercase text-[#F4F1EA]">
                        {stage.title}
                      </h4>
                      <p className="font-sans text-xs sm:text-sm text-[#B8B5AE] mt-1">
                        {stage.subtitle}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`font-mono text-[10px] uppercase tracking-[0.18em] shrink-0 mt-1 px-2.5 py-1 border ${
                      isCurrent
                        ? 'border-[#C9B28F] text-[#C9B28F]'
                        : 'border-white/15 text-[#B8B5AE]'
                    }`}
                  >
                    {isCurrent ? 'Selected' : 'Inspect'}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Verified Technical Governance Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-l border-white/15">
          {PROTOCOL_METRICS.map((m) => (
            <div
              key={m.code}
              className="border-r border-b border-white/15 bg-[#1B1C1A] p-5 sm:p-6 space-y-1.5"
            >
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#C9B28F] font-semibold block">
                {m.code}
              </span>
              <p className="font-sans text-xs text-[#D6D4CF] leading-relaxed">
                {m.detail}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
