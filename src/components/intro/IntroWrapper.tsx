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
/**
 * In-memory per-document flag: resets on every full browser load/refresh,
 * while preventing replay during client-side Next.js route transitions.
 */
let hasCompletedIntroInDocument = false;

export const IntroWrapper = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const isHomepage = pathname === '/';

  const [showIntro, setShowIntro] = useState<boolean>(false);

  useIsomorphicLayoutEffect(() => {
    document.documentElement.removeAttribute('data-intro-pending');

    if (!isHomepage || prefersReducedMotion() || hasCompletedIntroInDocument) {
      setShowIntro(false);
      return;
    }

    setShowIntro(true);
  }, [isHomepage]);

  const handleEnter = useCallback(() => {
    hasCompletedIntroInDocument = true;
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
