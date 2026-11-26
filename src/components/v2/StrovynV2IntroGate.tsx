'use client';

import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { prefersReducedMotion } from '@/lib/motion/gsapConfig';
import { CinematicIntro } from '@/components/intro/CinematicIntro';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

let hasPlayedV2IntroInDocument = false;

/**
 * Isolated intro gate for `/prototype/v2` that reuses the production `CinematicIntro`
 * on every full browser reload without modifying `RootLayout` or `IntroWrapper`.
 */
export const StrovynV2IntroGate: React.FC = () => {
  const [showIntro, setShowIntro] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (prefersReducedMotion() || hasPlayedV2IntroInDocument) {
      setShowIntro(false);
      return;
    }
    setShowIntro(true);
  }, []);

  const handleEnter = useCallback(() => {
    hasPlayedV2IntroInDocument = true;
    setShowIntro(false);
  }, []);

  if (!showIntro) return null;
  return <CinematicIntro onEnter={handleEnter} />;
};
