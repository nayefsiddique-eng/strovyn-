'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { CinematicIntro } from './CinematicIntro';

/**
 * IntroWrapper — Server-layout-safe client shell.
 *
 * Renders the CinematicIntro overlay above the main website content on first visit to `/`.
 * Other pages (e.g. /about, /services) render immediately without the intro.
 */
export const IntroWrapper = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const isHomepage = pathname === '/';

  // null = not yet determined (SSR-safe). true = show intro. false = intro done.
  const [showIntro, setShowIntro] = useState<boolean | null>(null);

  useEffect(() => {
    // If user lands directly on an internal page, do not gate them with intro
    if (!isHomepage) {
      setShowIntro(false);
      return;
    }

    try {
      const seen = sessionStorage.getItem('strovyn_intro_seen');
      setShowIntro(seen !== 'true');
    } catch {
      setShowIntro(false);
    }
  }, [isHomepage]);

  const handleEnter = () => {
    try {
      sessionStorage.setItem('strovyn_intro_seen', 'true');
    } catch {
      // ignore
    }
    setShowIntro(false);
  };

  // During SSR and initial hydration: render children immediately so the page
  // is never blank for crawlers or non-JS visitors.
  if (showIntro === null) {
    return (
      <>
        {/* Invisible placeholder overlay so layout doesn't shift */}
        <div
          className="fixed inset-0 z-[200] bg-charcoal"
          aria-hidden="true"
          style={{ pointerEvents: 'none' }}
        />
        {children}
      </>
    );
  }

  return (
    <>
      {/* Cinematic Intro Overlay */}
      <AnimatePresence mode="wait">
        {showIntro && (
          <CinematicIntro key="cinematic-intro" onEnter={handleEnter} />
        )}
      </AnimatePresence>

      {/* Main Website Content — fades in after intro exits */}
      <motion.div
        initial={false}
        animate={{
          opacity: showIntro ? 0 : 1,
          filter: showIntro ? 'blur(4px)' : 'blur(0px)',
        }}
        transition={{
          duration: 0.9,
          ease: [0.16, 1, 0.3, 1],
          delay: showIntro ? 0 : 0.1,
        }}
        style={{ willChange: 'opacity, filter' }}
      >
        {children}
      </motion.div>
    </>
  );
};

export default IntroWrapper;
