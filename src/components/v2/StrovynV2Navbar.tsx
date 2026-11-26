'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUpRight, Menu, Moon, Sun, X } from 'lucide-react';
import { WHATSAPP_DETAILS } from '@/lib/constants';
import { cn } from '@/lib/utils';

const V2_NAV_LINKS = [
  { label: 'Services', href: '#v2-services', sectionId: 'v2-services' },
  { label: 'Finishes', href: '#finish-studio', sectionId: 'finish-studio' },
  { label: 'Approach', href: '#v2-approach', sectionId: 'v2-approach' },
  { label: 'Portfolio', href: '#v2-portfolio', sectionId: 'v2-portfolio' },
  { label: 'Insights', href: '#insights', sectionId: 'insights' },
  { label: 'FAQ', href: '#v2-faq', sectionId: 'v2-faq' },
  { label: 'Visualiser', href: '/visualiser' },
  { label: 'About', href: '/about' },
] as const;

export const StrovynV2Navbar: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('v2-hero');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const syncTheme = () => setIsDark(document.documentElement.classList.contains('dark'));
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => {
      setIsScrolled(window.scrollY > 56);
      if (window.scrollY < 140) {
        setActiveSection('v2-hero');
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const sectionIds = [
      'v2-craft',
      'v2-services',
      'finish-studio',
      'v2-approach',
      'v2-portfolio',
      'endorsements',
      'insights',
      'v2-faq',
      'v2-consultation',
    ];
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    const io = new IntersectionObserver(
      (entries) => {
        if (window.scrollY < 140) return;
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible?.target.id) {
          setActiveSection(visible.target.id);
        }
      },
      { rootMargin: '-30% 0px -45% 0px', threshold: [0.15, 0.35] }
    );
    elements.forEach((el) => io.observe(el));

    return () => {
      window.removeEventListener('scroll', onScroll);
      io.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setDrawerOpen(false);
        requestAnimationFrame(() => menuBtnRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [drawerOpen]);

  const toggleTheme = () => {
    const nextDark = !document.documentElement.classList.contains('dark');
    if (nextDark) {
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
    setIsDark(nextDark);
  };

  const inverseHeroMode = !isScrolled;

  return (
    <>
      <header
        data-v2-navbar="true"
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-colors duration-300 border-b',
          inverseHeroMode
            ? 'bg-[#141513]/72 border-white/15 text-[#F4F1EA]'
            : 'bg-[#FAF8F5]/96 dark:bg-[#181917]/96 border-[#B8B5AE]/45 dark:border-white/10 text-[#20211F] dark:text-[#F4F1EA]'
        )}
      >
        <nav
          aria-label="Primary architectural navigation"
          className="mx-auto flex h-16 md:h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-12"
        >
          {/* Left: Official STROVYN Wordmark (Anton, no trailing dot) */}
          <div className="flex items-center gap-4 shrink-0">
            <Link
              href="/prototype/v2"
              aria-label="STROVYN Home"
              className="flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#A78B65]"
            >
              <span
                className={cn(
                  'font-display text-2xl sm:text-[1.7rem] tracking-[0.04em] uppercase leading-none',
                  inverseHeroMode ? 'text-[#F4F1EA]' : 'text-[#20211F] dark:text-[#F4F1EA]'
                )}
              >
                STROVYN
              </span>
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 bg-[#C41E1E]"
              />
              <span
                className={cn(
                  'hidden xl:inline-block font-mono text-[10px] uppercase tracking-[0.22em] border-l pl-3',
                  inverseHeroMode
                    ? 'border-white/20 text-[#D6D4CF]'
                    : 'border-[#B8B5AE]/60 dark:border-white/15 text-[#595651] dark:text-[#B8B5AE]'
                )}
              >
                Adelaide &middot; SA
              </span>
            </Link>
          </div>

          {/* Center: Editorial Links */}
          <div className="hidden lg:flex items-center gap-6 xl:gap-7">
            {V2_NAV_LINKS.map((item) => {
              const isSectionActive =
                'sectionId' in item && activeSection === item.sectionId;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className={cn(
                    'relative py-1 font-sans text-[11px] uppercase tracking-[0.18em] font-medium transition-colors',
                    inverseHeroMode
                      ? isSectionActive
                        ? 'text-white'
                        : 'text-[#E5E2DA]/80 hover:text-white'
                      : isSectionActive
                        ? 'text-[#20211F] dark:text-white'
                        : 'text-[#595651] dark:text-[#B8B5AE] hover:text-[#20211F] dark:hover:text-white'
                  )}
                >
                  {item.label}
                  {isSectionActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 -bottom-0.5 h-[2px] bg-[#C41E1E]"
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right: Theme Toggle + Consultation CTA + Mobile Menu */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              data-testid="v2-theme-toggle"
              className={cn(
                'inline-flex h-10 w-10 items-center justify-center border transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-[#A78B65]',
                inverseHeroMode
                  ? 'border-white/25 text-[#F4F1EA] hover:border-[#C9B28F] hover:text-[#C9B28F]'
                  : 'border-[#B8B5AE]/60 dark:border-white/20 text-[#20211F] dark:text-[#F4F1EA] hover:border-[#7E6340]'
              )}
            >
              {isDark ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>

            <Link
              href="/contact"
              className="hidden sm:inline-flex h-10 items-center gap-2 px-4 bg-[#C41E1E] hover:bg-[#A01818] text-white font-mono text-[11px] uppercase tracking-[0.18em] font-medium transition-colors"
            >
              <span>Get a Quote</span>
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>

            <button
              ref={menuBtnRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              aria-controls="v2-mobile-drawer"
              className={cn(
                'inline-flex lg:hidden h-10 w-10 items-center justify-center border transition-colors cursor-pointer',
                inverseHeroMode
                  ? 'border-white/25 text-[#F4F1EA]'
                  : 'border-[#B8B5AE]/60 dark:border-white/20 text-[#20211F] dark:text-[#F4F1EA]'
              )}
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </nav>
      </header>

      {/* Mobile Architectural Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.div
            id="v2-mobile-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-[#161715] text-[#F4F1EA] flex flex-col justify-between p-6 sm:p-8"
          >
            <div className="flex items-center justify-between border-b border-white/15 pb-5">
              <div className="flex items-center gap-2.5">
                <span className="font-display text-2xl tracking-[0.04em] uppercase text-[#F4F1EA]">
                  STROVYN
                </span>
                <span className="h-1.5 w-1.5 bg-[#C41E1E]" aria-hidden="true" />
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="inline-flex h-10 w-10 items-center justify-center border border-white/25 text-[#F4F1EA] cursor-pointer"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <nav className="my-auto py-6 flex flex-col divide-y divide-white/10">
              {[
                { label: 'Home (Current Site)', href: '/' },
                { label: 'Services', href: '/services' },
                { label: 'Projects Portfolio', href: '/projects' },
                { label: 'Wall Colour Visualiser', href: '/visualiser' },
                { label: 'Editorial Insights', href: '/insights' },
                { label: 'About Strovyn', href: '/about' },
                { label: 'Careers', href: '/careers' },
                { label: 'Contact & Quotes', href: '/contact' },
              ].map((link, idx) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setDrawerOpen(false)}
                  className="py-3.5 flex items-center justify-between group"
                >
                  <span className="font-display text-2xl uppercase tracking-wide text-[#F4F1EA] group-hover:text-[#C9B28F] transition-colors">
                    {link.label}
                  </span>
                  <span className="font-mono text-[11px] text-[#B8B5AE]">
                    0{idx + 1}
                  </span>
                </Link>
              ))}
            </nav>

            <div className="border-t border-white/15 pt-5 flex flex-col gap-3">
              <Link
                href="/contact"
                onClick={() => setDrawerOpen(false)}
                className="w-full py-3.5 px-5 bg-[#C41E1E] text-white text-center font-mono text-xs uppercase tracking-[0.2em] font-medium"
              >
                Request Consultation
              </Link>
              <a
                href={WHATSAPP_DETAILS.chatUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 px-5 border border-white/20 text-[#D6D4CF] text-center font-mono text-xs uppercase tracking-[0.16em]"
              >
                WhatsApp {WHATSAPP_DETAILS.internationalDisplay}
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
