'use client';

import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { prefersReducedMotion } from '@/lib/motion/gsapConfig';
import { CinematicIntro } from '@/components/intro/CinematicIntro';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

const introPlayedByRoute = new Set<string>();

export const V3IntroGate: React.FC<{ routeKey: string }> = ({ routeKey }) => {
  const [showIntro, setShowIntro] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (prefersReducedMotion() || introPlayedByRoute.has(routeKey)) {
      setShowIntro(false);
      return;
    }
    setShowIntro(true);
  }, [routeKey]);

  const handleEnter = useCallback(() => {
    introPlayedByRoute.add(routeKey);
    setShowIntro(false);
  }, [routeKey]);

  if (!showIntro) return null;
  return <CinematicIntro onEnter={handleEnter} />;
};

export function useV3Theme() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const sync = () => setIsDark(document.documentElement.classList.contains('dark'));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  const toggleTheme = useCallback(() => {
    const willBeDark = !document.documentElement.classList.contains('dark');
    if (willBeDark) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('strovyn-theme', 'dark');
      } catch {}
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('strovyn-theme', 'light');
      } catch {}
    }
    setIsDark(willBeDark);
  }, []);

  return { isDark, toggleTheme };
}
