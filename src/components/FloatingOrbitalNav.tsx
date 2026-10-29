import React, { useState } from 'react';
import type { AppRoutePath } from '../App';
import { useMagneticHover } from '../hooks/useMotionSystem';

interface SubRouteItem {
  path: AppRoutePath;
  label: string;
  badge?: string | number;
}

interface FloatingOrbitalNavProps {
  currentRoute: AppRoutePath;
  onNavigate: (path: AppRoutePath, nodeLabel?: string) => void;
  totalBooks: number;
  totalBorrowers: number;
  activeLoans: number;
  overdueLoans: number;
  totalLoans: number;
}

interface OrbitalCornerButtonProps {
  cornerClass: string;
  floatAnimClass: string;
  codeLabel: string;
  subtitle: string;
  iconName: string;
  badgeText?: string;
  badgeVariant?: 'gold' | 'emerald' | 'rose';
  isActiveSection: boolean;
  defaultPath: AppRoutePath;
  currentRoute: AppRoutePath;
  subRoutes: SubRouteItem[];
  alignMenu: 'left' | 'right';
  verticalMenu: 'down' | 'up';
  onNavigate: (path: AppRoutePath, nodeLabel?: string) => void;
}

const OrbitalCornerNode: React.FC<OrbitalCornerButtonProps> = ({
  cornerClass,
  floatAnimClass,
  codeLabel,
  subtitle,
  iconName,
  badgeText,
  badgeVariant = 'gold',
  isActiveSection,
  defaultPath,
  currentRoute,
  subRoutes,
  alignMenu,
  verticalMenu,
  onNavigate,
}) => {
  const [expanded, setExpanded] = useState(false);
  const { elementRef, onPointerMove, onPointerLeave } = useMagneticHover(7, 4);

  const badgeStyle =
    badgeVariant === 'emerald'
      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
      : badgeVariant === 'rose'
      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
      : 'bg-white/10 text-[#ffd085] border border-[#ffd085]/30';

  return (
    <div
      className={`${cornerClass} z-50 pointer-events-auto select-none ${floatAnimClass} hover:[animation-play-state:paused] focus-within:[animation-play-state:paused]`}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => {
        setExpanded(false);
        onPointerLeave();
      }}
    >
      <div
        ref={elementRef}
        onPointerMove={onPointerMove}
        className="relative transition-transform duration-200 ease-out"
      >
        <button
          type="button"
          onClick={() => onNavigate(defaultPath, codeLabel)}
          onFocus={() => setExpanded(true)}
          aria-label={`${codeLabel} ${subtitle}`}
          aria-expanded={expanded}
          className={`group relative flex items-center p-2.5 sm:p-3.5 apple-glass transition-all duration-300 cursor-pointer text-left ${
            isActiveSection
              ? 'border-[#ffd085]/70 shadow-[0_14px_36px_rgba(255,208,133,0.22)] ring-1 ring-[#ffd085]/40'
              : 'hover:border-[#ffd085]/60 hover:shadow-[0_16px_36px_rgba(218,165,32,0.25)]'
          }`}
        >
          <div
            className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0 ${
              isActiveSection
                ? 'bg-[#ffd085] text-[#191c19] border border-[#ffd085]'
                : 'bg-white/10 border border-white/20 text-[#fbf8ee] group-hover:bg-[#ffd085] group-hover:text-[#191c19]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px] sm:text-[22px]">{iconName}</span>
          </div>

          <div className="ml-2.5 sm:ml-3 pr-1.5 sm:pr-2 hidden sm:block">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[11px] sm:text-xs font-mono font-bold transition-colors whitespace-nowrap ${
                  isActiveSection ? 'text-[#ffd085]' : 'text-[#fbf8ee] group-hover:text-[#ffd085]'
                }`}
              >
                {codeLabel}
              </span>
              {badgeText && (
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${badgeStyle}`}>
                  {badgeText}
                </span>
              )}
            </div>
            <p className="text-[10px] sm:text-[11px] text-[#b5b8ad] whitespace-nowrap">
              {subtitle}
            </p>
          </div>

          {isActiveSection && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5" aria-hidden="true">
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#ffd085]" />
            </span>
          )}
        </button>

        {/* Expandable Sub-Route Floating Drawer */}
        {expanded && subRoutes.length > 1 && (
          <div
            className={`absolute ${
              verticalMenu === 'down' ? 'top-full mt-2' : 'bottom-full mb-2'
            } ${
              alignMenu === 'left' ? 'left-0' : 'right-0'
            } min-w-[215px] p-2 apple-glass-table space-y-1 z-50 animate-aura-enter`}
          >
            <div className="px-2.5 py-1 text-[9px] font-mono uppercase tracking-wider text-[#b5b8ad] border-b border-white/10">
              {codeLabel} // SUB-ROUTES
            </div>
            {subRoutes.map((sub) => {
              const isSubActive = currentRoute === sub.path;
              return (
                <button
                  key={sub.path}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(sub.path, sub.label);
                    setExpanded(false);
                  }}
                  className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                    isSubActive
                      ? 'bg-[#ffd085] text-[#191c19] font-bold'
                      : 'text-[#fbf8ee] hover:bg-white/10 hover:text-[#ffd085]'
                  }`}
                >
                  <span className="truncate">{sub.label}</span>
                  {sub.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded ${
                        isSubActive ? 'bg-black/20 text-[#191c19]' : 'bg-white/10 text-[#ffd085]'
                      }`}
                    >
                      {sub.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export const FloatingOrbitalNav: React.FC<FloatingOrbitalNavProps> = ({
  currentRoute,
  onNavigate,
  totalBooks,
  totalBorrowers,
  activeLoans,
  overdueLoans,
  totalLoans,
}) => {
  const isOverviewActive = currentRoute === '/' || currentRoute.startsWith('/reports');
  const isAnalyticsActive = currentRoute.startsWith('/python');
  const isLibraryActive = currentRoute.startsWith('/catalog');
  const isCirculationActive = currentRoute.startsWith('/circulation');

  return (
    <nav aria-label="Floating Orbital Library Navigation">
      {/* 1. UPPER-LEFT: OVERVIEW */}
      <OrbitalCornerNode
        cornerClass="fixed top-4 left-4 md:top-7 md:left-7"
        floatAnimClass="floating-cube-1"
        codeLabel="01 // OVERVIEW"
        subtitle="Root Telemetry Workspace"
        iconName="grid_view"
        badgeText={overdueLoans > 0 ? `${overdueLoans} DUE` : 'SYNC'}
        badgeVariant={overdueLoans > 0 ? 'rose' : 'gold'}
        isActiveSection={isOverviewActive}
        defaultPath="/"
        currentRoute={currentRoute}
        alignMenu="left"
        verticalMenu="down"
        onNavigate={onNavigate}
        subRoutes={[
          { path: '/', label: 'Overview & Scroll Story' },
          { path: '/reports/overdue', label: 'Overdue Watchlist', badge: overdueLoans },
          { path: '/reports/popular', label: 'Most-Borrowed Books', badge: totalBooks },
          { path: '/reports/statistics', label: 'Pandas & NumPy Stats' },
        ]}
      />

      {/* 2. UPPER-RIGHT: ANALYTICS (PYTHON & SQL STUDIO) */}
      <OrbitalCornerNode
        cornerClass="fixed top-4 right-4 md:top-7 md:right-7"
        floatAnimClass="floating-cube-2"
        codeLabel="02 // ANALYTICS"
        subtitle="Python & SQL Studio"
        iconName="monitoring"
        badgeText="PY 3.12"
        badgeVariant="gold"
        isActiveSection={isAnalyticsActive}
        defaultPath="/python"
        currentRoute={currentRoute}
        alignMenu="right"
        verticalMenu="down"
        onNavigate={onNavigate}
        subRoutes={[
          { path: '/python', label: 'Python CLI Runner' },
          { path: '/python/sql', label: 'SQL Query Workbench' },
          { path: '/python/source', label: 'Submission Source Files', badge: 4 },
          { path: '/python/presentation', label: 'Presentation Deck', badge: '9 slides' },
        ]}
      />

      {/* 3. LOWER-LEFT: LIBRARY (CATALOG & BORROWERS) */}
      <OrbitalCornerNode
        cornerClass="fixed bottom-4 left-4 md:bottom-7 md:left-7"
        floatAnimClass="floating-cube-3"
        codeLabel="03 // LIBRARY"
        subtitle="Grand Research Stacks"
        iconName="menu_book"
        badgeText={`${totalBooks}B · ${totalBorrowers}P`}
        badgeVariant="gold"
        isActiveSection={isLibraryActive}
        defaultPath="/catalog"
        currentRoute={currentRoute}
        alignMenu="left"
        verticalMenu="up"
        onNavigate={onNavigate}
        subRoutes={[
          { path: '/catalog', label: 'Books Inventory', badge: totalBooks },
          { path: '/catalog/borrowers', label: 'Borrowers Directory', badge: totalBorrowers },
        ]}
      />

      {/* 4. LOWER-RIGHT: CIRCULATION (ISSUE/RETURN & LEDGER) */}
      <OrbitalCornerNode
        cornerClass="fixed bottom-4 right-4 md:bottom-7 md:right-7"
        floatAnimClass="floating-cube-4"
        codeLabel="04 // CIRCULATION"
        subtitle="Active Ledger Hub"
        iconName="swap_horiz"
        badgeText={`${activeLoans} LIVE`}
        badgeVariant="emerald"
        isActiveSection={isCirculationActive}
        defaultPath="/circulation"
        currentRoute={currentRoute}
        alignMenu="right"
        verticalMenu="up"
        onNavigate={onNavigate}
        subRoutes={[
          { path: '/circulation', label: 'Issue & Return Desk' },
          { path: '/circulation/ledger', label: 'Transactions Ledger', badge: totalLoans },
        ]}
      />
    </nav>
  );
};
