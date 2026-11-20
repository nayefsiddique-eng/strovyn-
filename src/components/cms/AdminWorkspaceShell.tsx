'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Briefcase,
  Camera,
  FileText,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  LogOut,
  MessageSquareQuote,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  getAdminNavigationForRole,
  type AdminModuleId,
  type AdminNavItem,
} from '@/lib/cms/adminNavigation';
import { describeStaffRole } from '@/lib/cms/stage1Access';
import type { StaffViewerIdentity } from './StaffAuthGateCards';

function getModuleIcon(id: AdminModuleId) {
  switch (id) {
    case 'overview':
      return <LayoutDashboard className="w-4 h-4" aria-hidden="true" />;
    case 'articles':
      return <FileText className="w-4 h-4" aria-hidden="true" />;
    case 'projects':
      return <FolderKanban className="w-4 h-4" aria-hidden="true" />;
    case 'testimonials':
      return <MessageSquareQuote className="w-4 h-4" aria-hidden="true" />;
    case 'careers':
      return <Briefcase className="w-4 h-4" aria-hidden="true" />;
    case 'quote-requests':
      return <Inbox className="w-4 h-4" aria-hidden="true" />;
    case 'job-applications':
      return <Users className="w-4 h-4" aria-hidden="true" />;
    case 'customer-feedback':
      return <MessageSquareQuote className="w-4 h-4" aria-hidden="true" />;
    case 'media-library':
      return <Camera className="w-4 h-4" aria-hidden="true" />;
    case 'ai-content-studio':
      return <Sparkles className="w-4 h-4" aria-hidden="true" />;
  }
}

export function AdminWorkspaceShell({
  staff,
  activeModule,
  children,
}: {
  staff: StaffViewerIdentity;
  activeModule: AdminModuleId;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  const navItems = getAdminNavigationForRole(staff.role);
  const roleMeta = describeStaffRole(staff.role);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut().catch(() => {});
      await fetch('/api/admin/insights/session', { method: 'DELETE' }).catch(() => {});
    } finally {
      setSigningOut(false);
      router.refresh();
    }
  };

  const renderNavLink = (item: AdminNavItem, compact = false) => {
    const isActive = item.id === activeModule;
    const isPlanned = item.status === 'planned';
    return (
      <Link
        key={item.id}
        href={item.href}
        aria-current={isActive ? 'page' : undefined}
        className={`flex items-center justify-between gap-2 px-3 py-2 text-xs font-sans border transition-colors ${
          isActive
            ? 'bg-charcoal text-ivory border-charcoal font-medium'
            : 'bg-white text-charcoal border-warm-grey/40 hover:border-charcoal'
        } ${compact ? 'whitespace-nowrap flex-shrink-0' : 'w-full'}`}
      >
        <span className="inline-flex items-center gap-2">
          {getModuleIcon(item.id)}
          <span>{item.label}</span>
        </span>
        {!compact && isPlanned && (
          <span
            className={`font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 border ${
              isActive
                ? 'border-ivory/30 text-ivory/80'
                : 'border-warm-grey/60 text-warm-grey-dark'
            }`}
          >
            {item.phaseLabel}
          </span>
        )}
      </Link>
    );
  };

  return (
    <div className="w-full min-h-screen bg-ivory text-charcoal pt-24 sm:pt-28 pb-20 px-4 sm:px-6 lg:px-10">
      <div className="max-w-7xl mx-auto">
        {/* Shared CMS Workspace Top Strip */}
        <header className="bg-white border border-warm-grey/60 p-4 sm:p-5 mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-bronze">
                [ STROVYN BUSINESS CMS ]
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 border border-warm-grey/60 bg-ivory-light font-mono text-[10px] uppercase tracking-wider text-charcoal">
                <ShieldCheck className="w-3 h-3 text-bronze" aria-hidden="true" />
                {roleMeta.label}
              </span>
            </div>
            <p className="font-sans text-xs text-warm-grey-dark">
              Signed in as <strong className="text-charcoal">{staff.full_name}</strong> ({staff.email})
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 border border-warm-grey text-xs font-mono uppercase tracking-wider text-charcoal hover:border-charcoal transition-colors"
            >
              Public Site
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-warm-grey text-xs font-mono uppercase tracking-wider text-charcoal hover:border-charcoal cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{signingOut ? 'Signing Out...' : 'Sign Out'}</span>
            </button>
          </div>
        </header>

        {/* Mobile Horizontal Module Nav */}
        <nav
          aria-label="Business CMS modules"
          className="lg:hidden flex items-center gap-2 overflow-x-auto pb-3 mb-6"
        >
          {navItems.map((item) => renderNavLink(item, true))}
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Desktop Unified Navigation Sidebar */}
          <aside
            aria-label="Business CMS navigation"
            className="hidden lg:block lg:col-span-3 space-y-4 sticky top-24"
          >
            <div className="bg-white border border-warm-grey/60 p-4 space-y-4">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-bronze mb-2">
                  Content &amp; Showcase
                </p>
                <div className="space-y-1.5">
                  {navItems
                    .filter((i) => i.group === 'core')
                    .map((item) => renderNavLink(item))}
                </div>
              </div>

              {navItems.some((i) => i.group === 'submissions') && (
                <div className="pt-3 border-t border-warm-grey/30">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-bronze mb-2">
                    Client Submissions
                  </p>
                  <div className="space-y-1.5">
                    {navItems
                      .filter((i) => i.group === 'submissions')
                      .map((item) => renderNavLink(item))}
                  </div>
                </div>
              )}

              {navItems.some((i) => i.group === 'future') && (
                <div className="pt-3 border-t border-warm-grey/30">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-warm-grey-dark mb-2">
                    Future Studio
                  </p>
                  <div className="space-y-1.5">
                    {navItems
                      .filter((i) => i.group === 'future')
                      .map((item) => renderNavLink(item))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Active Workspace Content */}
          <div className="lg:col-span-9 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
