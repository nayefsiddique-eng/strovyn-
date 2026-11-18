"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface NavItem {
  label: string;
  href: string;
}

export const navItems: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Services", href: "/services" },
  { label: "Projects", href: "/projects" },
  { label: "Insights", href: "/insights" },
  { label: "Careers", href: "/careers" },
  { label: "Contact", href: "/contact" },
];

export interface HeaderProps {
  /**
   * If true, header renders with solid ivory background at all times,
   * bypassing the scroll threshold (useful for pages without dark hero sections).
   */
  forceSolid?: boolean;
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({
  forceSolid = false,
  className,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Scroll listener to detect when page is scrolled past ~50px
  useEffect(() => {
    const handleScroll = () => {
      const scrolled = window.scrollY > 50;
      setIsScrolled(scrolled);
    };

    // Initial check on mount
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile menu on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = () => {
    const willBeDark = !document.documentElement.classList.contains("dark");
    if (willBeDark) {
      document.documentElement.classList.add("dark");
      try {
        localStorage.setItem("strovyn-theme", "dark");
      } catch {
        // Fallback for private browsing storage restrictions
      }
      setIsDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      try {
        localStorage.setItem("strovyn-theme", "light");
      } catch {
        // Fallback for private browsing storage restrictions
      }
      setIsDark(false);
    }
  };

  const isHome = pathname === "/";
  const isSolid = true; // Reference design uses clean white background with crisp charcoal links

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 w-full border-b backdrop-blur-sm",
          isScrolled
            ? "bg-white/96 border-black/[0.08] dark:bg-[#181917]/96 dark:border-white/[0.08]"
            : "bg-white border-black/[0.04] dark:bg-[#181917] dark:border-white/[0.06]",
          className
        )}
      >
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between h-16 md:h-20">
              {/* Left: Brand Logo Text / Wordmark as per Reference */}
              <Link
                href="/"
                className="group inline-flex items-center gap-2 focus-visible:outline-none"
                aria-label="Strovyn Painting Co. - Return to homepage"
              >
                <span className="font-display tracking-[0.06em] text-2xl sm:text-3xl text-charcoal font-bold uppercase">
                  STROVYN<span className="text-brand-red">.</span>
                </span>
              </Link>

            {/* Center: Desktop Navigation Links */}
            <nav
              className="hidden lg:flex items-center gap-7 xl:gap-9"
              aria-label="Main Navigation"
            >
              {navItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname === item.href ||
                      pathname?.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "group relative py-2 text-xs font-sans uppercase tracking-[0.16em] transition-colors duration-200",
                      isActive
                        ? isSolid
                          ? "text-charcoal font-semibold"
                          : "!text-white font-bold tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                        : isSolid
                        ? "text-charcoal/80 hover:text-bronze"
                        : "!text-white/90 hover:!text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                    )}
                  >
                    <span>{item.label}</span>
                    {/* Architectural Brand-Red Underline that slides in from left */}
                    <span
                      className={cn(
                        "absolute bottom-0 left-0 h-[2px] bg-brand-red transition-all duration-300 ease-out origin-left",
                        isActive ? "w-full" : "w-0 group-hover:w-full"
                      )}
                      aria-hidden="true"
                    />
                  </Link>
                );
              })}
            </nav>

            {/* Right: Theme Toggle, Desktop CTA & Mobile Hamburger */}
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Theme Toggle Button (40x40px Minimal Circular Toggle) */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
                className="w-10 h-10 rounded-full border border-warm-grey/40 dark:border-white/20 hover:border-bronze dark:hover:border-bronze flex items-center justify-center transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-bronze cursor-pointer bg-transparent"
              >
                {/* Moon Icon for Light Mode (hidden in Dark Mode) */}
                <svg
                  className="w-4 h-4 text-charcoal transition-transform duration-300 motion-safe:hover:-rotate-12 block dark:hidden"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>

                {/* Sun Icon for Dark Mode (hidden in Light Mode) */}
                <svg
                  className="w-4 h-4 text-white transition-transform duration-300 motion-safe:hover:rotate-45 hidden dark:block"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              </button>

              <div className="hidden sm:block">
                <Link
                  href="/contact"
                  className="inline-flex items-center justify-center bg-[#111110] hover:bg-black !text-white hover:!text-white px-6 py-2.5 font-mono text-xs uppercase tracking-[0.18em] font-semibold transition-colors shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red"
                >
                  <span className="!text-white font-semibold">GET A QUOTE</span>
                </Link>
              </div>

              {/* Mobile Hamburger Trigger (3 thin architectural lines) */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open mobile navigation menu"
                aria-expanded={mobileMenuOpen}
                className="lg:hidden flex flex-col justify-center items-center w-10 h-10 gap-1.5 focus:outline-none cursor-pointer"
              >
                <span
                  className={cn(
                    "block w-6 h-[1.5px] transition-colors duration-200",
                    isSolid ? "bg-charcoal" : "bg-white"
                  )}
                />
                <span
                  className={cn(
                    "block w-6 h-[1.5px] transition-colors duration-200",
                    isSolid ? "bg-charcoal" : "bg-white"
                  )}
                />
                <span
                  className={cn(
                    "block w-6 h-[1.5px] transition-colors duration-200",
                    isSolid ? "bg-charcoal" : "bg-white"
                  )}
                />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Fullscreen Mobile Navigation Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            key="mobile-nav-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 1, 0.5, 1] }}
            className="fixed inset-0 z-[60] bg-ivory text-charcoal flex flex-col justify-between overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-label="Mobile Navigation Menu"
          >
            {/* Top Bar inside Menu */}
            <div className="border-b border-warm-grey/30">
              <div className="max-w-7xl mx-auto px-6 sm:px-8 py-5 flex items-center justify-between">
                <Link
                  href="/"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-start"
                >
                  <div className="w-[100px]">
                    <Image
                      src="/images/strovyn-logo.png"
                      alt="Strovyn Painting Co."
                      width={200}
                      height={67}
                      className="w-full h-auto"
                    />
                  </div>
                </Link>

                {/* Close Button (X) */}
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Close mobile navigation menu"
                  className="w-10 h-10 flex items-center justify-center text-charcoal hover:text-bronze transition-colors focus:outline-none cursor-pointer"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      strokeLinecap="square"
                      strokeLinejoin="miter"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Mobile Navigation Links */}
            <div className="max-w-7xl w-full mx-auto px-6 sm:px-8 py-10 flex-1 flex flex-col justify-center">
              <nav
                className="flex flex-col divide-y divide-warm-grey/20 border-y border-warm-grey/20"
                aria-label="Mobile Navigation Links"
              >
                {navItems.map((item, index) => {
                  const isActive =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname === item.href ||
                        pathname?.startsWith(`${item.href}/`);

                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, x: -16 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: 0.05 * index,
                        duration: 0.35,
                        ease: [0.25, 1, 0.5, 1],
                      }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "group py-4 sm:py-5 flex items-center justify-between text-2xl sm:text-3xl font-serif transition-colors",
                          isActive
                            ? "text-bronze font-normal"
                            : "text-charcoal hover:text-bronze"
                        )}
                      >
                        <span className="flex items-center gap-4">
                          <span className="font-sans text-xs tracking-[0.14em] text-warm-grey-dark uppercase font-normal">
                            0{index + 1}
                          </span>
                          <span>{item.label}</span>
                        </span>
                        <span
                          className={cn(
                            "text-sm font-sans tracking-[0.1em] uppercase transition-transform duration-200 group-hover:translate-x-1",
                            isActive ? "text-bronze" : "text-warm-grey"
                          )}
                        >
                          →
                        </span>
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>
            </div>

            {/* Bottom Callout & Action */}
            <div className="border-t border-warm-grey/30 bg-ivory">
              <div className="max-w-7xl mx-auto px-6 sm:px-8 py-6 flex flex-col gap-4">
                <Button
                  href="/contact"
                  variant="primary"
                  size="md"
                  className="w-full justify-center tracking-[0.14em]"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Get a Quote
                </Button>
                <div className="flex flex-col sm:flex-row items-center justify-between text-xs tracking-[0.1em] text-charcoal-muted uppercase font-sans gap-2 text-center sm:text-left pt-2">
                  <span>Adelaide, South Australia</span>
                  <a
                    href="https://wa.me/61406646061"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-charcoal transition-colors"
                  >
                    WhatsApp: +61 406 646 061
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default Header;
