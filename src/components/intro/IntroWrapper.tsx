'use client';

import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { prefersReducedMotion } from '@/lib/motion/gsapConfig';
import { CinematicIntro } from './CinematicIntro';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * IntroWrapper — Server-layout-safe client shell.
 *
 * Plays the architectural cinematic opening automatically once per browser session on `/`.
 * Reduced-motion visitors receive the homepage immediately without delay.
 * Internal routes render immediately without interruption.
 */
export const IntroWrapper = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const isHomepage = pathname === '/';

  const [showIntro, setShowIntro] = useState<boolean>(false);

  useIsomorphicLayoutEffect(() => {
    document.documentElement.removeAttribute('data-intro-pending');

    if (!isHomepage || prefersReducedMotion()) {
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

  const handleEnter = useCallback(() => {
    try {
      sessionStorage.setItem('strovyn_intro_seen', 'true');
    } catch {
      // ignore private storage restrictions
    }
    document.documentElement.removeAttribute('data-intro-pending');
    setShowIntro(false);
  }, []);

  return (
    <>
      {showIntro && <CinematicIntro onEnter={handleEnter} />}
      {children}
    </>
  );
};

export default IntroWrapper;
