/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnalyticsDashboard, type AnalyticsSubRoute } from './components/AnalyticsDashboard';
import { CirculationDesk, type CirculationSubRoute } from './components/CirculationDesk';
import { CatalogAndBorrowers, type CatalogSubRoute } from './components/CatalogAndBorrowers';
import { PythonStudio, type PythonSubRoute } from './components/PythonStudio';
import { FloatingOrbitalNav } from './components/FloatingOrbitalNav';
import { usePrefersReducedMotion } from './hooks/useMotionSystem';
import type { LoanRecord } from './utils/circulationRules';

export type AppRoutePath =
  | '/'
  | '/reports/overdue'
  | '/reports/popular'
  | '/reports/statistics'
  | '/circulation'
  | '/circulation/ledger'
  | '/catalog'
  | '/catalog/borrowers'
  | '/python'
  | '/python/sql'
  | '/python/source'
  | '/python/presentation';

type TopSection = 'analytics' | 'circulation' | 'catalog' | 'python';

const VALID_ROUTES: AppRoutePath[] = [
  '/',
  '/reports/overdue',
  '/reports/popular',
  '/reports/statistics',
  '/circulation',
  '/circulation/ledger',
  '/catalog',
  '/catalog/borrowers',
  '/python',
  '/python/sql',
  '/python/source',
  '/python/presentation',
];

function normalizePath(rawPath: string): AppRoutePath {
  const cleaned = rawPath.replace(/\/+$/, '') || '/';
  if ((VALID_ROUTES as string[]).includes(cleaned)) {
    return cleaned as AppRoutePath;
  }
  if (cleaned.startsWith('/reports')) return '/reports/overdue';
  if (cleaned.startsWith('/circulation')) return '/circulation';
  if (cleaned.startsWith('/catalog')) return '/catalog';
  if (cleaned.startsWith('/python')) return '/python';
  return '/';
}

function getTopSection(route: AppRoutePath): TopSection {
  if (route === '/' || route.startsWith('/reports')) return 'analytics';
  if (route.startsWith('/circulation')) return 'circulation';
  if (route.startsWith('/catalog')) return 'catalog';
  return 'python';
}

export default function App() {
  const [currentRoute, setCurrentRoute] = useState<AppRoutePath>(() =>
    typeof window !== 'undefined' ? normalizePath(window.location.pathname) : '/'
  );
  const [appState, setAppState] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [selectedLoanForReturn, setSelectedLoanForReturn] = useState<LoanRecord | null>(null);
  const [routeToast, setRouteToast] = useState<string | null>(null);

  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const navigate = useCallback((path: AppRoutePath, nodeLabel?: string) => {
    setCurrentRoute(path);
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (nodeLabel) {
      setRouteToast(`Route Active: ${nodeLabel}`);
    }
  }, []);

  useEffect(() => {
    if (!routeToast) return;
    const t = window.setTimeout(() => setRouteToast(null), 2100);
    return () => window.clearTimeout(t);
  }, [routeToast]);

  // Parallax background transform on scroll (respects prefers-reduced-motion)
  useEffect(() => {
    if (prefersReducedMotion) {
      if (bgImageRef.current) {
        bgImageRef.current.style.transform = 'scale(1.03) translate3d(0px, 0px, 0px)';
      }
      return;
    }

    let ticking = false;
    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        if (bgImageRef.current) {
          const yOffset = Math.min(90, window.scrollY * 0.08);
          const scale = 1.04 + Math.min(0.04, window.scrollY * 0.00003);
          bgImageRef.current.style.transform = `scale(${scale.toFixed(3)}) translate3d(0px, -${yOffset.toFixed(1)}px, 0px)`;
        }
        ticking = false;
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [prefersReducedMotion]);

  useEffect(() => {
    const onPopState = () => {
      setCurrentRoute(normalizePath(window.location.pathname));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      if (data.ok && data.state) {
        setAppState(data.state);
        setErrorBanner(null);
      } else {
        setErrorBanner(data.error || 'Failed to load Python backend state.');
      }
    } catch (err: any) {
      setErrorBanner(err.message || 'Network error connecting to Python backend.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  const handleUpdateSettings = async (dueDays: number, referenceDate: string) => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ default_due_days: dueDays, reference_date: referenceDate }),
      });
      const data = await res.json();
      if (data.ok && data.state) {
        setAppState(data.state);
        setErrorBanner(null);
      } else {
        setErrorBanner(data.error || 'Could not update due policy settings.');
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleIssueBook = async (payload: {
    book_id: number;
    borrower_id: number;
    issue_date: string;
    due_date: string;
  }) => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/loans/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok && data.state) {
        setAppState(data.state);
      }
      return data;
    } finally {
      setIsBusy(false);
    }
  };

  const handleReturnBook = async (payload: { loan_id: number; return_date: string }) => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/loans/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok && data.state) {
        setAppState(data.state);
      }
      return data;
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddBook = async (payload: {
    isbn: string;
    title: string;
    author: string;
    category: string;
    copies_available: number;
  }) => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok && data.state) {
        setAppState(data.state);
      }
      return data;
    } finally {
      setIsBusy(false);
    }
  };

  const handleAddBorrower = async (payload: { borrower_name: string; roll_no: string }) => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/borrowers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok && data.state) {
        setAppState(data.state);
      }
      return data;
    } finally {
      setIsBusy(false);
    }
  };

  const handleRunCliReport = async () => {
    const res = await fetch('/api/python/cli-report', { method: 'POST' });
    const data = await res.json();
    if (data.ok && data.state) {
      setAppState(data.state);
    }
    return data;
  };

  const handleRunSql = async (sql: string) => {
    const res = await fetch('/api/sql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql }),
    });
    return res.json();
  };

  const handleResetDatabase = async () => {
    setIsBusy(true);
    try {
      const res = await fetch('/api/reset', { method: 'POST' });
      const data = await res.json();
      if (data.ok && data.state) {
        setAppState(data.state);
      }
    } finally {
      setIsBusy(false);
    }
  };

  const handleDownloadFullPythonReport = async () => {
    const data = await handleRunCliReport();
    if (data?.report_text) {
      const blob = new Blob([data.report_text], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'python_library_usage_analysis_report.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleQuickReturnFromDashboard = (loan: LoanRecord) => {
    setSelectedLoanForReturn(loan);
    navigate('/circulation', 'Circulation Desk');
  };

  const activeTopSection = getTopSection(currentRoute);

  const subRouteMap: Record<TopSection, { path: AppRoutePath; label: string; badge?: string | number }[]> = {
    analytics: [
      { path: '/', label: 'Overview & Scroll Story' },
      {
        path: '/reports/overdue',
        label: 'Overdue Watchlist',
        badge: appState?.kpis?.overdue_loans ?? 0,
      },
      {
        path: '/reports/popular',
        label: 'Most-Borrowed Books',
        badge: appState?.kpis?.total_books_titles ?? 10,
      },
      { path: '/reports/statistics', label: 'Pandas & NumPy Stats' },
    ],
    circulation: [
      { path: '/circulation', label: 'Issue & Return Desk' },
      {
        path: '/circulation/ledger',
        label: 'Transactions Ledger',
        badge: appState?.kpis?.total_loans ?? 0,
      },
    ],
    catalog: [
      {
        path: '/catalog',
        label: 'Books Inventory',
        badge: appState?.books?.length ?? 0,
      },
      {
        path: '/catalog/borrowers',
        label: 'Borrowers Directory',
        badge: appState?.borrowers?.length ?? 0,
      },
    ],
    python: [
      { path: '/python', label: 'Python CLI Runner' },
      { path: '/python/sql', label: 'SQL Query Workbench' },
      { path: '/python/source', label: 'Submission Source Files', badge: 4 },
      { path: '/python/presentation', label: 'Presentation Deck', badge: '9 slides' },
    ],
  };

  const currentSubRoutes = subRouteMap[activeTopSection];

  const analyticsSubView: AnalyticsSubRoute =
    currentRoute === '/reports/overdue'
      ? 'overdue'
      : currentRoute === '/reports/popular'
      ? 'popular'
      : currentRoute === '/reports/statistics'
      ? 'statistics'
      : 'overview';

  const circulationSubView: CirculationSubRoute =
    currentRoute === '/circulation/ledger' ? 'ledger' : 'desk';

  const catalogSubView: CatalogSubRoute =
    currentRoute === '/catalog/borrowers' ? 'borrowers' : 'books';

  const pythonSubView: PythonSubRoute =
    currentRoute === '/python/sql'
      ? 'sql'
      : currentRoute === '/python/source'
      ? 'source'
      : currentRoute === '/python/presentation'
      ? 'presentation'
      : 'cli';

  return (
    <div className="min-h-screen bg-[#070908] text-[#fbf8ee] font-sans antialiased selection:bg-[#c49a55]/30 selection:text-[#ffd085] relative overflow-x-hidden">
      {/* 1. BACKGROUND ENVIRONMENT: FULL-BLEED 100VW FIXED PHOTOREALISTIC LIBRARY WITH SCROLL PARALLAX */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
        <img
          ref={bgImageRef}
          alt=""
          className="w-full h-full object-cover object-center filter brightness-[0.60] contrast-[1.08] saturate-[1.05] scale-[1.04] transition-transform duration-150 ease-out will-change-transform"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuC2k-8KU8OQeOwHSaifG6qIgOcWidPZA3YAs6SYtfRBoANfGqk5smk_FmdiaL-P2-8vYB00qhMiCdFRRwG5InuN72zr-LX3-Idu-7bjUlr_IxPB_7FbOLX-jQzvGiIerEI_JXjBC7LOl0R3raNs5vZ83Byd6wSy92hCzX_iFyN1PXocnBndf5RWF0ScxETrR27Pi5NKhNkzXFqnmhTGKkEEnokEOzIMUeAMB1FL9fw"
        />
        {/* Subtle dark atmospheric vignette overlay keeping library depth crisp */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/42 to-black/78" />
        {/* Fine architectural measurement lines */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.4) 1px, transparent 1px)',
            backgroundSize: '120px 120px',
          }}
        />
        {/* Ambient floating warm light reflection on desks */}
        <div className="absolute top-1/4 left-1/3 w-[600px] h-[400px] rounded-full bg-[#e8a838]/10 blur-[130px] ambient-light" />
        <div className="absolute bottom-10 right-1/4 w-[500px] h-[350px] rounded-full bg-[#426b55]/15 blur-[120px] ambient-light" />
      </div>

      {/* 2. EXACTLY FOUR INDEPENDENT FLOATING ORBITAL NAVIGATION OBJECTS (NO TOP NAVBAR OR SIDEBAR) */}
      <FloatingOrbitalNav
        currentRoute={currentRoute}
        onNavigate={navigate}
        totalBooks={appState?.books?.length ?? 10}
        totalBorrowers={appState?.borrowers?.length ?? 8}
        activeLoans={appState?.kpis?.active_loans ?? 0}
        overdueLoans={appState?.kpis?.overdue_loans ?? 0}
        totalLoans={appState?.kpis?.total_loans ?? 0}
      />

      {/* Floating Route Toast Notification */}
      {routeToast && (
        <div
          role="status"
          className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full apple-glass border border-[#ffd085]/50 shadow-2xl text-xs font-mono text-[#fbf8ee] font-semibold flex items-center gap-2 z-50 animate-aura-enter pointer-events-none"
        >
          <span className="w-2 h-2 rounded-full bg-[#ffd085]" />
          <span>{routeToast}</span>
        </div>
      )}

      {/* 3. EXPANSIVE 1400PX DESKTOP COMPOSITION & EDITORIAL CONTENT */}
      <main className="relative z-10 w-full max-w-[1400px] mx-auto px-5 sm:px-8 pt-24 pb-28 md:pt-28 md:pb-28 space-y-8">
        {/* REAL-TIME DISPATCH MICRO TELEMETRY STRIP + CONTEXTUAL SUB-ROUTE SWITCHER */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5 apple-glass glass-edge-sweep">
          <div className="flex items-center gap-3 text-xs font-mono text-[#b5b8ad] flex-wrap">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigate('/', 'Overview');
              }}
              className="px-2.5 py-1 rounded-md bg-white/10 border border-white/15 text-[#ffd085] font-bold tracking-wide hover:bg-[#ffd085] hover:text-[#191c19] transition-colors"
            >
              PYLIB_ANALYTICS // CORE
            </a>
            <span className="text-white/20 hidden sm:inline">//</span>
            <span className="text-[#fbf8ee] hidden lg:inline">GRAND SCANDINAVIAN RESEARCH STACKS</span>
            <span className="text-white/20 hidden lg:inline">//</span>

            {/* Contextual Sub-Route Pills */}
            <div className="flex items-center gap-1.5 flex-wrap" role="navigation" aria-label="Section Views">
              {currentSubRoutes.map((sub) => {
                const isActive = currentRoute === sub.path;
                return (
                  <button
                    key={sub.path}
                    type="button"
                    onClick={() => navigate(sub.path, sub.label)}
                    className={`px-3 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer ${
                      isActive
                        ? 'bg-[#ffd085] text-[#191c19] font-bold shadow-[0_4px_14px_rgba(255,208,133,0.3)]'
                        : 'bg-white/5 text-[#d8dad0] hover:bg-white/15 hover:text-[#ffd085] border border-white/10'
                    }`}
                  >
                    <span>{sub.label}</span>
                    {sub.badge !== undefined && (
                      <span
                        className={`text-[10px] ${
                          isActive ? 'text-[#191c19]/80 font-extrabold' : 'text-[#ffd085]'
                        }`}
                      >
                        ({sub.badge})
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-[#b5b8ad]">
            <span className="hidden xl:flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="material-symbols-outlined text-[15px]">check_circle</span>
              PYTHON 3.12 ENGINE
            </span>
            <span className="text-white/20 hidden xl:inline">|</span>
            <button
              type="button"
              onClick={handleDownloadFullPythonReport}
              className="px-3.5 py-1.5 rounded-lg bg-[#ffd085]/20 hover:bg-[#ffd085] text-[#ffd085] hover:text-[#191c19] border border-[#ffd085]/40 font-mono text-xs font-bold transition-all cursor-pointer whitespace-nowrap"
            >
              Download Python Report
            </button>
          </div>
        </div>

        {errorBanner && (
          <div
            role="alert"
            className="p-4 apple-glass border-l-4 border-rose-500 text-sm text-rose-300 flex items-center justify-between"
          >
            <span>{errorBanner}</span>
            <button
              type="button"
              onClick={fetchState}
              className="px-3 py-1 text-xs font-mono font-bold bg-rose-500/20 border border-rose-500/40 rounded-lg hover:bg-rose-500/30 cursor-pointer"
            >
              Retry Connection
            </button>
          </div>
        )}

        {loading && !appState ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading Python circulation engine">
            <div className="h-64 apple-glass animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="h-36 apple-glass animate-pulse" />
              <div className="h-36 apple-glass animate-pulse" />
              <div className="h-36 apple-glass animate-pulse" />
              <div className="h-36 apple-glass animate-pulse" />
            </div>
            <div className="h-80 apple-glass animate-pulse" />
          </div>
        ) : (
          <div key={currentRoute} className="animate-aura-enter">
            {activeTopSection === 'analytics' && (
              <AnalyticsDashboard
                state={appState}
                subRoute={analyticsSubView}
                onNavigateRoute={(p) => navigate(p)}
                onUpdateSettings={handleUpdateSettings}
                onQuickReturnLoan={handleQuickReturnFromDashboard}
                onNavigateToDesk={() => navigate('/circulation', 'Circulation Desk')}
                onNavigateToPython={() => navigate('/python/source', 'Python Source')}
                isBusy={isBusy}
              />
            )}

            {activeTopSection === 'circulation' && (
              <CirculationDesk
                subRoute={circulationSubView}
                onNavigateRoute={(p) => navigate(p)}
                books={appState?.books || []}
                borrowers={appState?.borrowers || []}
                loans={appState?.loans || []}
                defaultDueDays={appState?.settings?.default_due_days ?? 14}
                referenceDate={appState?.settings?.reference_date || '2026-10-28'}
                selectedLoanForReturn={selectedLoanForReturn}
                onClearSelectedLoan={() => setSelectedLoanForReturn(null)}
                onIssueBook={handleIssueBook}
                onReturnBook={handleReturnBook}
                isBusy={isBusy}
              />
            )}

            {activeTopSection === 'catalog' && (
              <CatalogAndBorrowers
                subRoute={catalogSubView}
                onNavigateRoute={(p) => navigate(p)}
                books={appState?.books || []}
                borrowers={appState?.borrowers || []}
                onAddBook={handleAddBook}
                onAddBorrower={handleAddBorrower}
                isBusy={isBusy}
              />
            )}

            {activeTopSection === 'python' && (
              <PythonStudio
                subRoute={pythonSubView}
                onNavigateRoute={(p) => navigate(p)}
                onRunCliReport={handleRunCliReport}
                onRunSql={handleRunSql}
                onResetDatabase={handleResetDatabase}
                isBusy={isBusy}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
}
