'use client';

import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { CinematicIntro } from './CinematicIntro';

/**
 * IntroWrapper — Server-layout-safe client shell.
 *
 * Displays the architectural editorial opening once per browser session on `/`.
 * Exit animation runs cleanly inside CinematicIntro via GSAP before unmounting,
 * so there is zero Framer Motion / GSAP overlap and zero SSR blocking.
 * Internal routes render immediately without any interruption.
 */
export const IntroWrapper = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const isHomepage = pathname === '/';

  const [showIntro, setShowIntro] = useState<boolean>(false);

  useEffect(() => {
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
      // ignore private storage restrictions
    }
    setShowIntro(false);
  };

  return (
    <>
      {showIntro && <CinematicIntro onEnter={handleEnter} />}
      {children}
    </>
  );
};

export default IntroWrapper;
