'use client';

import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

interface FAQItem {
  question: string;
  answer: string;
  category: 'Preparation & Standards' | 'Quotations & Process' | 'Materials & Chemistry' | 'Adelaide Service';
}

const FAQ_DATA: FAQItem[] = [
  {
    category: 'Preparation & Standards',
    question: 'What is Strovyn’s zero-tolerance surface preparation process?',
    answer:
      'We invest significant craftsmanship and focus in substrate diagnostics, crack remediation, planar skim leveling, and dust-controlled orbital sanding. We never paint over unstable, chalking, or poorly bonded surfaces.',
  },
  {
    category: 'Preparation & Standards',
    question: 'How do you handle high-raking sunlight across ceilings and walls?',
    answer:
      'Raking natural light exposes every joint defect. We illuminate surfaces with 500-lumen cross-axis inspection lights during mechanical sanding passes to ensure continuous planar uniformity before coatings are applied.',
  },
  {
    category: 'Quotations & Process',
    question: 'Do you offer free on-site consultations across Adelaide?',
    answer:
      'Yes. We provide free on-site consultations across greater metropolitan Adelaide — from Glenelg to the Adelaide Hills, and Gawler to McLaren Vale. We diagnose the substrate, measure square meterage, and issue detailed written schedules.',
  },
  {
    category: 'Quotations & Process',
    question: 'What is your daylight sign-off procedure before handover?',
    answer:
      'Before handover, our lead painter inspects all finished surfaces under natural ambient daylight alongside the client to ensure hand-cut lines, sheen consistency, and uniform opacity satisfy expectations.',
  },
  {
    category: 'Materials & Chemistry',
    question: 'Are your interior paints safe, low-VOC, and family-friendly?',
    answer:
      'Yes. We prioritize ultra-low VOC, low-odour waterborne formulations that allow spaces to be inhabited quickly with zero toxic lingering off-gassing.',
  },
  {
    category: 'Materials & Chemistry',
    question: 'Can you finish fine cabinetry and bespoke millwork?',
    answer:
      'Yes. Our team handles fine spray lacquering for custom kitchens, vanities, and architectural woodwork using high-durability conversion coatings and velvet satin finishes.',
  },
  {
    category: 'Adelaide Service',
    question: 'Which areas of South Australia do you service?',
    answer:
      'We service metro Adelaide including North Adelaide, Norwood, Unley, Burnside, Prospect, Glenelg, Brighton, Blackwood, Crafers, Stirling, Gawler, and McLaren Vale.',
  },
];

export const SearchableFAQ: React.FC = () => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  const categories = ['All', 'Preparation & Standards', 'Quotations & Process', 'Materials & Chemistry', 'Adelaide Service'];

  const filtered = FAQ_DATA.filter((item) => {
    const matchesCat = activeCategory === 'All' || item.category === activeCategory;
    const matchesSearch =
      item.question.toLowerCase().includes(search.toLowerCase()) ||
      item.answer.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <section aria-label="Frequently Asked Questions" className="py-20 md:py-28 px-6 sm:px-8 lg:px-12 max-w-7xl mx-auto border-b border-warm-grey/30">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <span className="font-sans text-xs uppercase tracking-[0.2em] text-bronze font-medium block mb-3">
            [ 01 / TRANSPARENT METHODOLOGY ]
          </span>
          <h2 className="type-section-title text-3xl sm:text-4xl md:text-5xl text-charcoal mb-4">
            Frequently Asked Questions
          </h2>
          <p className="font-sans text-base text-charcoal/75 max-w-xl mx-auto leading-relaxed">
            Clear answers regarding our substrate preparation, free Adelaide consultations, paint chemistry, and daylight sign-offs.
          </p>
        </div>

        {/* Search & Filter */}
        <div className="mb-10 space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-warm-grey-dark" />
            <input
              type="text"
              aria-label="Search frequently asked questions"
              placeholder="Search painting questions, preparation, VOCs, consults..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white border border-warm-grey/40 pl-11 pr-4 py-3 text-xs sm:text-sm font-sans text-charcoal focus:outline-none focus:border-bronze"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`font-sans text-xs uppercase tracking-wider px-3.5 py-1.5 border transition-all cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-charcoal text-white border-charcoal'
                    : 'bg-white text-charcoal/70 border-warm-grey/30 hover:border-charcoal'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Accordion List */}
        <div className="space-y-3">
          {filtered.map((item, index) => {
            const isExpanded = expandedIndex === index;
            return (
              <div
                key={index}
                className="bg-white border border-warm-grey/30 overflow-hidden transition-colors"
              >
                <button
                  type="button"
                  onClick={() => setExpandedIndex(isExpanded ? null : index)}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-ivory/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <HelpCircle size={16} className="text-bronze flex-shrink-0" />
                    <span className="font-sans text-base sm:text-lg text-charcoal font-semibold leading-snug">
                      {item.question}
                    </span>
                  </div>
                  {isExpanded ? (
                    <ChevronUp size={18} className="text-bronze flex-shrink-0" />
                  ) : (
                    <ChevronDown size={18} className="text-warm-grey-dark flex-shrink-0" />
                  )}
                </button>

                {isExpanded && (
                  <div className="px-5 pb-6 pt-1 sm:px-6 sm:pb-6 text-sm sm:text-base font-sans text-charcoal/80 leading-relaxed border-t border-warm-grey/15">
                    {item.answer}
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="p-8 text-center bg-white border border-warm-grey/30 text-sm text-warm-grey-dark">
              No specific FAQ matched your search. Ask our AI Assistant or request a free consultation.
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
