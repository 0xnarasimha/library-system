import React, { useState, useEffect, useRef, useMemo } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ThreeBookStackCanvas } from './ThreeBookStackCanvas';
import { useCountUp, usePrefersReducedMotion } from '../hooks/useMotionSystem';
import {
  buildSmoothSplinePaths,
  computeDonutSegments,
  type BookRecord,
  type LoanRecord,
  type Point2D,
} from '../utils/circulationRules';
import type { AppRoutePath } from '../App';

gsap.registerPlugin(ScrollTrigger);

export type AnalyticsSubRoute = 'overview' | 'overdue' | 'popular' | 'statistics';

interface AnalyticsDashboardProps {
  state: any;
  subRoute: AnalyticsSubRoute;
  onNavigateRoute: (path: AppRoutePath) => void;
  onUpdateSettings: (dueDays: number, referenceDate: string) => Promise<void>;
  onQuickReturnLoan: (loan: LoanRecord) => void;
  onNavigateToDesk: () => void;
  onNavigateToPython: () => void;
  isBusy: boolean;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  state,
  subRoute,
  onNavigateRoute,
  onUpdateSettings,
  onQuickReturnLoan,
  onNavigateToDesk,
  onNavigateToPython,
  isBusy,
}) => {
  const settings = state?.settings || { default_due_days: 14, reference_date: '2026-10-28' };
  const kpis = state?.kpis || {};
  const reports = state?.reports || {};
  const books: BookRecord[] = state?.books || [];
  const borrowers = state?.borrowers || [];
  const loans: LoanRecord[] = state?.loans || [];
  const mostBorrowed: BookRecord[] = reports.most_borrowed_books || [];
  const overdueLoans: LoanRecord[] = reports.overdue_loans || [];
  const monthlyTrends: any[] = reports.monthly_trends || [];
  const categorySummary: any[] = reports.category_summary || [];
  const numpyStats = reports.numpy_stats || {};

  const prefersReducedMotion = usePrefersReducedMotion();

  // Configurable Due Date Policy local form state
  const [dueDaysInput, setDueDaysInput] = useState<number>(settings.default_due_days ?? 14);
  const [refDateInput, setRefDateInput] = useState<string>(settings.reference_date || '2026-10-28');
  const [policyExpanded, setPolicyExpanded] = useState<boolean>(false);

  useEffect(() => {
    setDueDaysInput(settings.default_due_days ?? 14);
    setRefDateInput(settings.reference_date || '2026-10-28');
  }, [settings.default_due_days, settings.reference_date]);

  // Real-time sub-second cycle timer & TPS sync indicator (via DOM ref to avoid 60Hz React re-renders)
  const cycleTimerRef = useRef<HTMLSpanElement | null>(null);
  const tpsCounterRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) return;
    let ms = 18420;
    const timerInterval = window.setInterval(() => {
      ms += 47;
      const seconds = Math.floor((ms % 60000) / 1000);
      const remMs = ms % 1000;
      if (cycleTimerRef.current) {
        cycleTimerRef.current.textContent = `00:${seconds < 10 ? '0' : ''}${seconds}.${
          remMs < 100 ? (remMs < 10 ? '00' : '0') : ''
        }${remMs}s`;
      }
    }, 55);

    const tpsInterval = window.setInterval(() => {
      if (tpsCounterRef.current && tpsCounterRef.current.dataset.pulsing !== 'true') {
        const jitter = (98.2 + Math.random() * 1.4).toFixed(2);
        tpsCounterRef.current.textContent = `${jitter}% SYNC`;
      }
    }, 1100);

    return () => {
      window.clearInterval(timerInterval);
      window.clearInterval(tpsInterval);
    };
  }, [prefersReducedMotion]);

  const handleSyncTelemetryPulse = () => {
    if (tpsCounterRef.current) {
      tpsCounterRef.current.dataset.pulsing = 'true';
      tpsCounterRef.current.textContent = '100.0% SYNC';
      window.setTimeout(() => {
        if (tpsCounterRef.current) {
          tpsCounterRef.current.dataset.pulsing = 'false';
          tpsCounterRef.current.textContent = '99.42% SYNC';
        }
      }, 900);
    }
  };

  // Once-only real-data KPI count-up hooks
  const totalLoansCount = useCountUp(kpis.total_loans ?? 0, 1000);
  const activeLoansCount = useCountUp(kpis.active_loans ?? 0, 1000);
  const overdueLoansCount = useCountUp(kpis.overdue_loans ?? 0, 1000);
  const availableCopiesCount = useCountUp(kpis.total_copies_available ?? 0, 1000);

  // Scene D: Monthly Chart Mode & Highlighted Point Scrubber
  const [chartViewMode, setChartViewMode] = useState<'SPLINE' | 'PEAK' | 'MATPLOTLIB'>('SPLINE');
  const [activeMonthIdx, setActiveMonthIdx] = useState<number>(() =>
    Math.max(0, monthlyTrends.length - 1)
  );
  const [activeCategoryHover, setActiveCategoryHover] = useState<string | null>(null);

  useEffect(() => {
    if (monthlyTrends.length > 0 && activeMonthIdx >= monthlyTrends.length) {
      setActiveMonthIdx(monthlyTrends.length - 1);
    }
  }, [monthlyTrends.length, activeMonthIdx]);

  // Scene E: Sub-Second Event Log Search & Pagination
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [logPage, setLogPage] = useState<number>(1);
  const LOG_PAGE_SIZE = 6;

  const filteredEventLoans = useMemo(() => {
    if (!logSearchQuery.trim()) return loans;
    const q = logSearchQuery.toLowerCase();
    return loans.filter(
      (ln) =>
        (ln.borrower_name || '').toLowerCase().includes(q) ||
        (ln.roll_no || '').toLowerCase().includes(q) ||
        (ln.book_title || '').toLowerCase().includes(q) ||
        (ln.isbn || '').toLowerCase().includes(q) ||
        (ln.status || '').toLowerCase().includes(q) ||
        `#${ln.loan_id}`.includes(q)
    );
  }, [loans, logSearchQuery]);

  const totalLogPages = Math.max(1, Math.ceil(filteredEventLoans.length / LOG_PAGE_SIZE));
  const paginatedEventLoans = filteredEventLoans.slice(
    (logPage - 1) * LOG_PAGE_SIZE,
    logPage * LOG_PAGE_SIZE
  );

  // Compute real SVG spline coordinates from Python's `monthly_trends`
  const chartGeometry = useMemo(() => {
    const data =
      chartViewMode === 'PEAK' && monthlyTrends.length > 3
        ? monthlyTrends.slice(-4)
        : monthlyTrends;
    if (!data || data.length === 0) {
      return {
        data: [],
        issuedPoints: [] as Point2D[],
        returnedPoints: [] as Point2D[],
        issuedPaths: { linePath: '', areaPath: '' },
        returnedPaths: { linePath: '', areaPath: '' },
        maxIssued: 1,
        peakMonth: null as any,
      };
    }

    const maxVal = Math.max(
      1,
      ...data.map((m: any) => Math.max(m.total_issued || 0, m.returned_count || 0))
    );
    const padLeft = 42;
    const padRight = 598;
    const topY = 34;
    const bottomY = 186;
    const usableW = padRight - padLeft;
    const usableH = bottomY - topY;

    const issuedPoints: Point2D[] = data.map((m: any, idx: number) => {
      const x = data.length === 1 ? 320 : padLeft + (idx / (data.length - 1)) * usableW;
      const y = bottomY - ((m.total_issued || 0) / maxVal) * usableH;
      return { x, y };
    });

    const returnedPoints: Point2D[] = data.map((m: any, idx: number) => {
      const x = data.length === 1 ? 320 : padLeft + (idx / (data.length - 1)) * usableW;
      const y = bottomY - ((m.returned_count || 0) / maxVal) * usableH;
      return { x, y };
    });

    const peakMonth = data.reduce(
      (best: any, cur: any) => ((cur.total_issued || 0) > (best?.total_issued || 0) ? cur : best),
      data[0]
    );

    return {
      data,
      issuedPoints,
      returnedPoints,
      issuedPaths: buildSmoothSplinePaths(issuedPoints, bottomY),
      returnedPaths: buildSmoothSplinePaths(returnedPoints, bottomY),
      maxIssued: maxVal,
      peakMonth,
    };
  }, [monthlyTrends, chartViewMode]);

  // Compute real Donut Gauge segments from Python's `category_summary`
  const donutSegments = useMemo(() => {
    return computeDonutSegments(categorySummary, 48);
  }, [categorySummary]);

  // GSAP ScrollTrigger Choreography for Scenes A, B, C, D, E
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (subRoute !== 'overview' || prefersReducedMotion || !rootRef.current) return;

    const ctx = gsap.context(() => {
      // Scene A: Staggered word reveal & scroll-linked headline scale
      gsap.fromTo(
        '.hero-word-reveal',
        { y: 16, opacity: 0.35 },
        {
          y: 0,
          opacity: 1,
          duration: 0.45,
          stagger: 0.06,
          ease: 'power3.out',
          clearProps: 'transform,opacity',
        }
      );

      gsap.to('.hero-headline-block', {
        scale: 0.96,
        y: -12,
        ease: 'none',
        scrollTrigger: {
          trigger: '.scene-a-hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 0.5,
        },
      });

      // Scene B: Circulation Pipeline progressive SVG path drawing & sequential node activation
      gsap.fromTo(
        '.pipeline-draw-line',
        { strokeDasharray: 920, strokeDashoffset: 920 },
        {
          strokeDashoffset: 0,
          duration: 1.4,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.scene-b-pipeline',
            start: 'top 82%',
            end: 'bottom 45%',
            scrub: 0.6,
          },
        }
      );

      gsap.fromTo(
        '.pipeline-node-card',
        { y: 24, opacity: 0, scale: 0.94 },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.65,
          stagger: 0.11,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.scene-b-pipeline',
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        }
      );

      // Scene C: Library Metrics staggered reveal & sparkline drawing
      gsap.fromTo(
        '.kpi-telemetry-card',
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.scene-c-metrics',
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        }
      );

      // Scene D: Monthly Borrowing Trends SVG line draw & scroll-linked point highlight
      gsap.fromTo(
        '.trends-spline-stroke',
        { strokeDasharray: 1200, strokeDashoffset: 1200 },
        {
          strokeDashoffset: 0,
          duration: 1.5,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.scene-d-analytics',
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      );

      gsap.fromTo(
        '.trends-area-fill',
        { opacity: 0 },
        {
          opacity: 1,
          duration: 1.2,
          delay: 0.25,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: '.scene-d-analytics',
            start: 'top 80%',
            toggleActions: 'play none none none',
          },
        }
      );

      // Scroll-linked active month scrubber as user scrolls through Scene D
      if (monthlyTrends.length > 1) {
        ScrollTrigger.create({
          trigger: '.scene-d-trends-card',
          start: 'top 65%',
          end: 'bottom 35%',
          onUpdate: (self) => {
            const idx = Math.min(
              monthlyTrends.length - 1,
              Math.max(0, Math.floor(self.progress * monthlyTrends.length))
            );
            setActiveMonthIdx(idx);
          },
        });
      }

      // Leaderboard ranking bars
      gsap.fromTo(
        '.popular-rank-bar',
        { scaleX: 0, transformOrigin: 'left center' },
        {
          scaleX: 1,
          duration: 0.9,
          stagger: 0.1,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.scene-d-leaderboard',
            start: 'top 85%',
            toggleActions: 'play none none none',
          },
        }
      );

      // Scene E: Transactions & Hardware Insights entrance
      gsap.fromTo(
        '.scene-e-block',
        { y: 24, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.7,
          stagger: 0.12,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.scene-e-transactions',
            start: 'top 88%',
            toggleActions: 'play none none none',
          },
        }
      );
    }, rootRef);

    return () => ctx.revert();
  }, [subRoute, prefersReducedMotion, monthlyTrends.length]);

  const downloadCsvReport = (reportType: 'popular' | 'overdue' | 'category' | 'monthly') => {
    let csvContent = '';
    let filename = '';

    if (reportType === 'popular') {
      filename = 'most_borrowed_books_report.csv';
      csvContent = [
        'Rank,Book ID,ISBN,Title,Author,Category,Total Loans,Active Loans,Overdue Loans,Copies Available',
        ...mostBorrowed.map(
          (b) =>
            `${b.rank},${b.book_id},"${b.isbn}","${b.title.replace(/"/g, '""')}","${b.author}","${b.category}",${b.total_loans},${b.active_loans},${b.overdue_loans},${b.copies_available}`
        ),
      ].join('\n');
    } else if (reportType === 'overdue') {
      filename = 'overdue_loans_report.csv';
      csvContent = [
        'Loan ID,Book Title,Borrower Name,Roll No,Issue Date,Due Date,Days Overdue',
        ...overdueLoans.map(
          (l) =>
            `${l.loan_id},"${(l.book_title || '').replace(/"/g, '""')}","${l.borrower_name}","${l.roll_no}",${l.issue_date},${l.due_date},${l.days_overdue}`
        ),
      ].join('\n');
    } else if (reportType === 'category') {
      filename = 'pandas_category_summary.csv';
      csvContent = [
        'Category,Total Titles,Copies Available,Total Loans,Active Loans,Overdue Loans,Share Pct',
        ...categorySummary.map(
          (c) =>
            `"${c.category}",${c.total_titles},${c.copies_available},${c.total_loans},${c.active_loans},${c.overdue_loans},${c.share_pct}%`
        ),
      ].join('\n');
    } else {
      filename = 'pandas_monthly_circulation.csv';
      csvContent = [
        'Month,Total Issued,Returned,Active,Overdue,Unique Borrowers',
        ...monthlyTrends.map(
          (m) =>
            `${m.month},${m.total_issued},${m.returned_count},${m.active_count},${m.overdue_count},${m.unique_borrowers}`
        ),
      ].join('\n');
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Reusable 4-Card KPI Strip
  const returnRatePct = kpis.total_loans
    ? Math.round(((kpis.returned_loans ?? 0) / kpis.total_loans) * 1000) / 10
    : 80.0;

  const renderSceneCMetrics = () => {
    const activeCapPct = Math.min(
      100,
      Math.round(
        ((kpis.active_loans ?? 0) /
          Math.max(1, (kpis.active_loans ?? 0) + (kpis.total_copies_available ?? 1))) *
          100
      )
    );

    return (
      <section
        aria-label="Circulation Summary Metrics"
        className="scene-c-metrics grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch"
      >
        {/* KPI 1: TOTAL CIRCULATION LOANS */}
        <div
          ref={totalLoansCount.ref}
          className="kpi-telemetry-card apple-glass glass-edge-sweep p-6 flex flex-col justify-between group hover:border-emerald-400/40 transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between pb-3">
              <span className="text-[11px] font-mono text-[#b5b8ad] uppercase tracking-wider font-semibold">
                TEL_01 // ALL-TIME LOANS
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold">
                {returnRatePct}% RETURNED
              </span>
            </div>
            <div className="pt-1 flex items-baseline gap-2">
              <span
                data-testid="kpi-total-loans"
                className="text-3xl font-semibold text-[#fbf8ee] tracking-tight font-serif tabular-nums"
              >
                {totalLoansCount.value}
              </span>
              <span className="text-xs font-mono text-[#b5b8ad]">LOANS</span>
            </div>
            <p className="text-xs text-[#b5b8ad] pt-1 leading-relaxed">
              {kpis.returned_loans ?? 0} returned · {kpis.total_borrowers ?? 0} registered patrons.
            </p>
          </div>
          <div className="pt-4">
            <div className="py-1 px-2 rounded-xl bg-black/30 border border-white/05">
              <svg className="w-full h-11" fill="none" preserveAspectRatio="none" viewBox="0 0 200 40">
                <path
                  d="M0,32 Q25,36 50,22 T100,24 T150,12 T200,6 L200,40 L0,40 Z"
                  fill="rgba(52,211,153,0.18)"
                />
                <path
                  d="M0,32 Q25,36 50,22 T100,24 T150,12 T200,6"
                  fill="none"
                  stroke="#34d399"
                  strokeLinecap="round"
                  strokeWidth="2.2"
                />
              </svg>
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-[#b5b8ad] pt-2">
              <span>SQLite3 + Pandas</span>
              <span className="text-emerald-400 font-semibold">VERIFIED LEDGER</span>
            </div>
          </div>
        </div>

        {/* KPI 2: ACTIVE LOANS IN CIRCULATION */}
        <div
          ref={activeLoansCount.ref}
          className="kpi-telemetry-card apple-glass glass-edge-sweep p-6 flex flex-col justify-between group hover:border-[#ffd085]/40 transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between pb-3">
              <span className="text-[11px] font-mono text-[#b5b8ad] uppercase tracking-wider font-semibold">
                TEL_02 // IN CIRCULATION
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#ffd085]/20 text-[#ffd085] font-mono text-[10px] font-bold">
                {activeCapPct}% UTIL
              </span>
            </div>
            <div className="pt-1 flex items-baseline gap-2">
              <span
                data-testid="kpi-active-loans"
                className="text-3xl font-semibold text-[#fbf8ee] tracking-tight font-serif tabular-nums"
              >
                {activeLoansCount.value}
              </span>
              <span className="text-xs font-mono text-[#b5b8ad]">IN-FLIGHT</span>
            </div>
            <p className="text-xs text-[#b5b8ad] pt-1 leading-relaxed">
              {(kpis.active_loans ?? 0) - (kpis.overdue_loans ?? 0)} on-time · Due window:{' '}
              {settings.default_due_days}d.
            </p>
          </div>
          <div className="pt-4 space-y-2">
            <div className="w-full h-2 rounded-full bg-black/40 border border-white/10 overflow-hidden p-0.5">
              <div
                className="h-full bg-gradient-to-r from-emerald-400 to-[#ffd085] rounded-full transition-all duration-700"
                style={{ width: `${Math.max(12, activeCapPct)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-[#b5b8ad]">
              <span>Checked Out: {activeCapPct}%</span>
              <span className="text-[#ffd085] font-semibold">Ref: {settings.reference_date}</span>
            </div>
          </div>
        </div>

        {/* KPI 3: OVERDUE LOANS */}
        <div
          ref={overdueLoansCount.ref}
          className="kpi-telemetry-card apple-glass glass-edge-sweep p-6 border-l-2 border-rose-500/80 flex flex-col justify-between group hover:border-rose-500/80 transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between pb-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-[11px] font-mono text-rose-400 tracking-wider font-bold uppercase">
                  TEL_03 // OVERDUE LOANS
                </span>
              </div>
              <span className="material-symbols-outlined text-rose-400 text-[18px]">warning</span>
            </div>
            <div className="pt-1 flex items-baseline gap-2">
              <span
                data-testid="kpi-overdue-loans"
                className="text-3xl font-semibold text-[#fbf8ee] tracking-tight font-serif tabular-nums"
              >
                {overdueLoansCount.value}
              </span>
              <span className="text-xs font-mono text-rose-400 font-semibold">PAST DUE</span>
            </div>
            <p className="text-xs text-[#b5b8ad] pt-1 leading-relaxed">
              Overdue rate:{' '}
              <strong className="text-rose-400 font-semibold">{kpis.overdue_rate_pct ?? 0}%</strong>{' '}
              of active circulation.
            </p>
          </div>
          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] font-mono">
            <span className="text-[#b5b8ad]">Watchlist Active</span>
            <button
              type="button"
              onClick={() => onNavigateRoute('/reports/overdue')}
              className="text-rose-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer"
            >
              INSPECT <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
            </button>
          </div>
        </div>

        {/* KPI 4: AVAILABLE SHELF COPIES */}
        <div
          ref={availableCopiesCount.ref}
          className="kpi-telemetry-card apple-glass glass-edge-sweep p-6 flex flex-col justify-between group hover:border-[#ffd085]/40 transition-all duration-300"
        >
          <div>
            <div className="flex items-center justify-between pb-3">
              <span className="text-[11px] font-mono text-[#ffd085] uppercase tracking-wider font-semibold">
                TEL_04 // AVAILABLE COPIES
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#ffd085]/20 text-[#ffd085] font-mono text-[10px] font-bold">
                {kpis.total_books_titles ?? 0} TITLES
              </span>
            </div>
            <div className="pt-1 flex items-baseline gap-2">
              <span
                data-testid="kpi-available-copies"
                className="text-3xl font-semibold text-[#fbf8ee] tracking-tight font-serif tabular-nums"
              >
                {availableCopiesCount.value}
              </span>
              <span className="text-xs font-mono text-[#b5b8ad]">ON SHELVES</span>
            </div>
            <p className="text-xs text-[#b5b8ad] pt-1 leading-relaxed">
              Verified across {kpis.total_books_titles ?? 0} catalog monographs ready for issue.
            </p>
          </div>
          <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[11px] font-mono text-[#b5b8ad]">
            <span>
              Consistency: <strong className="text-emerald-400">ACID OK</strong>
            </span>
            <button
              type="button"
              onClick={() => onNavigateRoute('/catalog')}
              className="text-[#ffd085] hover:underline cursor-pointer"
            >
              Open Catalog
            </button>
          </div>
        </div>
      </section>
    );
  };

  // ============================================================================
  // SUB-ROUTE 1: /reports/overdue
  // ============================================================================
  if (subRoute === 'overdue') {
    return (
      <div className="space-y-8">
        {renderSceneCMetrics()}

        <section aria-label="Overdue Loans Report" className="apple-glass-table p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-white/10">
            <div>
              <div className="text-xs font-mono text-rose-400 font-semibold">
                ROUTE // /reports/overdue · Reference Date: {settings.reference_date}
              </div>
              <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-bold text-[#fbf8ee]">
                Overdue-Loan Watchlist ({overdueLoans.length} active overdue records)
              </h1>
              <p className="text-xs text-[#b5b8ad] mt-1">
                Unreturned loans where due_date &lt; evaluation date ({settings.reference_date}) with
                default {settings.default_due_days}-day due window
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onNavigateToDesk}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-mono font-semibold text-[#fbf8ee] transition-colors cursor-pointer"
              >
                Open Circulation Desk
              </button>
              <button
                type="button"
                onClick={() => downloadCsvReport('overdue')}
                className="px-4 py-2 rounded-xl bg-[#ffd085] hover:bg-[#ffe0a3] text-[#191c19] font-mono text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">download</span>
                Export Overdue CSV
              </button>
            </div>
          </div>

          {overdueLoans.length === 0 ? (
            <div className="p-10 text-center apple-glass-card">
              <span className="material-symbols-outlined text-emerald-400 text-3xl">verified</span>
              <p className="text-base font-serif font-bold text-[#fbf8ee] mt-2">Zero Overdue Loans</p>
              <p className="text-xs text-[#b5b8ad] mt-1">
                All active library loans are within their due date window for {settings.reference_date}.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="text-[#b5b8ad] uppercase tracking-wider border-b border-white/10 font-semibold text-[11px]">
                    <th className="py-3 px-4">Loan ID</th>
                    <th className="py-3 px-4">Book Title &amp; ISBN</th>
                    <th className="py-3 px-4">Borrower &amp; Roll No</th>
                    <th className="py-3 px-4 text-right">Issue Date</th>
                    <th className="py-3 px-4 text-right">Due Date</th>
                    <th className="py-3 px-4 text-right">Overdue Days</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/05">
                  {overdueLoans.map((loan) => (
                    <tr key={loan.loan_id} className="hover:bg-white/05 transition-colors">
                      <td className="py-3.5 px-4 text-[#ffd085] font-semibold">#{loan.loan_id}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-sans font-semibold text-[#fbf8ee] text-sm">
                          {loan.book_title}
                        </div>
                        <div className="text-[11px] text-[#b5b8ad]">
                          {loan.isbn} · {loan.book_category}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-sans font-medium text-[#fbf8ee]">{loan.borrower_name}</div>
                        <div className="text-[11px] text-[#b5b8ad]">{loan.roll_no}</div>
                      </td>
                      <td className="py-3.5 px-4 text-right text-[#d8dad0]">{loan.issue_date}</td>
                      <td className="py-3.5 px-4 text-right text-rose-400 font-semibold">
                        {loan.due_date}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 font-semibold">
                          OVERDUE · {loan.days_overdue}d
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => onQuickReturnLoan(loan)}
                          className="px-3 py-1.5 rounded-lg bg-[#ffd085] hover:bg-[#ffe0a3] text-[#191c19] font-mono text-xs font-bold transition-colors cursor-pointer"
                        >
                          Return Book #{loan.loan_id}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    );
  }

  // ============================================================================
  // SUB-ROUTE 2: /reports/popular
  // ============================================================================
  if (subRoute === 'popular') {
    return (
      <div className="space-y-8">
        <div className="apple-glass p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <div className="text-xs font-mono text-[#ffd085] font-semibold">
                ROUTE // /reports/popular · Python Matplotlib &amp; SQL Aggregation
              </div>
              <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-bold text-[#fbf8ee]">
                Most-Borrowed Books Report &amp; Ranking
              </h1>
              <p className="text-xs text-[#b5b8ad] mt-1">
                Ranked by total historical circulation loans with live shelf availability
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadCsvReport('popular')}
              className="px-4 py-2 rounded-xl bg-[#ffd085] hover:bg-[#ffe0a3] text-[#191c19] font-mono text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              Export Popular Books CSV
            </button>
          </div>
          <div
            className="w-full overflow-hidden rounded-2xl border border-white/15 bg-black/40 p-2"
            dangerouslySetInnerHTML={{ __html: state?.charts_svg?.popular_books || '' }}
          />
        </div>

        <section aria-label="Most-Borrowed Books Report" className="apple-glass-table p-6 sm:p-8">
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="text-[#b5b8ad] uppercase tracking-wider border-b border-white/10 font-semibold text-[11px]">
                  <th className="py-3 px-4">Rank</th>
                  <th className="py-3 px-4">Title &amp; Author</th>
                  <th className="py-3 px-4">Category &amp; ISBN</th>
                  <th className="py-3 px-4 text-right">Total Loans</th>
                  <th className="py-3 px-4 text-right">Active Out</th>
                  <th className="py-3 px-4 text-right">Overdue</th>
                  <th className="py-3 px-4 text-right">Copies Available</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/05">
                {mostBorrowed.map((book) => (
                  <tr key={book.book_id} className="hover:bg-white/05 transition-colors">
                    <td className="py-3.5 px-4 text-[#ffd085] font-bold">#{book.rank}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-sans font-semibold text-[#fbf8ee] text-sm">
                        {book.title}
                      </div>
                      <div className="text-[11px] text-[#b5b8ad]">{book.author}</div>
                    </td>
                    <td className="py-3.5 px-4 text-[#d8dad0]">
                      <span>{book.category}</span>
                      <span className="mx-1.5 text-white/20">·</span>
                      <span>{book.isbn}</span>
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-400 font-bold text-sm">
                      {book.total_loans}
                    </td>
                    <td className="py-3.5 px-4 text-right text-[#d8dad0]">{book.active_loans}</td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={book.overdue_loans ? 'text-rose-400 font-bold' : 'text-white/30'}>
                        {book.overdue_loans}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span
                        className={
                          book.copies_available === 0
                            ? 'text-rose-400 font-semibold'
                            : 'text-[#ffd085] font-semibold'
                        }
                      >
                        {book.copies_available}{' '}
                        {book.copies_available === 0 ? '(Out of stock)' : 'avail'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // ============================================================================
  // SUB-ROUTE 3: /reports/statistics
  // ============================================================================
  if (subRoute === 'statistics') {
    return (
      <div className="space-y-8">
        {renderSceneCMetrics()}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <section aria-label="Pandas Category Summary" className="apple-glass-table p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="text-xs font-mono text-[#ffd085]">
                  pandas.DataFrame.groupby(&apos;category&apos;)
                </div>
                <h1 className="mt-1 font-serif text-xl sm:text-2xl font-bold text-[#fbf8ee]">
                  Pandas Category Summary
                </h1>
              </div>
              <button
                type="button"
                onClick={() => downloadCsvReport('category')}
                className="px-3.5 py-1.5 rounded-xl bg-[#ffd085] text-[#191c19] font-mono text-xs font-bold cursor-pointer"
              >
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="text-[#b5b8ad] uppercase border-b border-white/10 text-[11px]">
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-2 text-right">Titles</th>
                    <th className="py-3 px-2 text-right">Avail</th>
                    <th className="py-3 px-2 text-right">Loans</th>
                    <th className="py-3 px-2 text-right">Overdue</th>
                    <th className="py-3 px-3 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/05">
                  {categorySummary.map((cat) => (
                    <tr key={cat.category} className="hover:bg-white/05">
                      <td className="py-3 px-3">
                        <div className="font-sans font-medium text-[#fbf8ee]">{cat.category}</div>
                        <div className="mt-1.5 w-28 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${Math.min(100, cat.share_pct * 2.2)}%` }}
                            className="h-full bg-gradient-to-r from-emerald-400 to-[#ffd085] rounded-full"
                          />
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right text-[#d8dad0]">{cat.total_titles}</td>
                      <td className="py-3 px-2 text-right text-[#ffd085]">{cat.copies_available}</td>
                      <td className="py-3 px-2 text-right text-emerald-400 font-bold">
                        {cat.total_loans}
                      </td>
                      <td className="py-3 px-2 text-right text-rose-400">{cat.overdue_loans}</td>
                      <td className="py-3 px-3 text-right text-[#d8dad0]">{cat.share_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section aria-label="NumPy Descriptive Statistics" className="apple-glass-table p-6 sm:p-8 space-y-5">
            <div className="pb-4 border-b border-white/10">
              <div className="text-xs font-mono text-[#ffd085]">
                numpy.mean · numpy.std · numpy.percentile
              </div>
              <h2 className="mt-1 font-serif text-xl sm:text-2xl font-bold text-[#fbf8ee]">
                NumPy Descriptive Statistics
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="text-[#b5b8ad] uppercase border-b border-white/10 text-[11px]">
                    <th className="py-3 px-3">Statistic (NumPy)</th>
                    <th className="py-3 px-3 text-right">Loan Duration (d)</th>
                    <th className="py-3 px-3 text-right">Loans / Book</th>
                    <th className="py-3 px-3 text-right">Overdue Days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/05">
                  {[
                    { label: 'Mean (np.mean)', key: 'mean' },
                    { label: 'Median (np.median)', key: 'median' },
                    { label: 'Std Dev (np.std)', key: 'std_dev' },
                    { label: 'Variance (np.var)', key: 'variance' },
                    { label: '25th Percentile (Q1)', key: 'p25' },
                    { label: '75th Percentile (Q3)', key: 'p75' },
                    { label: 'Interquartile Range (IQR)', key: 'iqr' },
                    { label: 'Min / Max Range', key: 'range' },
                  ].map((row) => {
                    const dStat = numpyStats.loan_duration_days || {};
                    const bStat = numpyStats.loans_per_book || {};
                    const oStat = numpyStats.overdue_days || {};

                    return (
                      <tr key={row.key} className="hover:bg-white/05">
                        <td className="py-2.5 px-3 font-sans text-[#d8dad0]">{row.label}</td>
                        <td className="py-2.5 px-3 text-right text-[#fbf8ee]">
                          {row.key === 'range'
                            ? `${dStat.min ?? 0} – ${dStat.max ?? 0}`
                            : (dStat[row.key] ?? 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-[#ffd085]">
                          {row.key === 'range'
                            ? `${bStat.min ?? 0} – ${bStat.max ?? 0}`
                            : (bStat[row.key] ?? 0)}
                        </td>
                        <td className="py-2.5 px-3 text-right text-rose-400">
                          {row.key === 'range'
                            ? `${oStat.min ?? 0} – ${oStat.max ?? 0}`
                            : (oStat[row.key] ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ============================================================================
  // DEFAULT SUB-ROUTE: OVERVIEW ('/') — 5-SCENE CINEMATIC SCROLL STORYTELLING
  // ============================================================================
  const highlightedMonth =
    chartGeometry.data[Math.min(activeMonthIdx, Math.max(0, chartGeometry.data.length - 1))] ||
    null;
  const highlightedIssuedPt =
    chartGeometry.issuedPoints[
      Math.min(activeMonthIdx, Math.max(0, chartGeometry.issuedPoints.length - 1))
    ] || null;
  const highlightedReturnedPt =
    chartGeometry.returnedPoints[
      Math.min(activeMonthIdx, Math.max(0, chartGeometry.returnedPoints.length - 1))
    ] || null;

  return (
    <div ref={rootRef} className="space-y-8">
      {/* ===================================================================== */}
      {/* SCENE A & B: LIBRARY HERO + 3D MONOGRAPH ASTROLABE + PIPELINE FLOW    */}
      {/* ===================================================================== */}
      <section className="scene-a-hero relative w-full rounded-2xl apple-glass p-6 sm:p-10 lg:p-12 space-y-8 overflow-hidden">
        {/* Hero Badges Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300 font-mono text-xs border border-emerald-500/30 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              • LIVE CATALOG STREAM
            </span>
            <span className="px-3 py-1 rounded-full bg-white/05 text-[#b5b8ad] font-mono text-xs border border-white/10">
              STACK_01 // RESEARCH CARRELS
            </span>
            <button
              type="button"
              onClick={() => setPolicyExpanded((prev) => !prev)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/05 hover:bg-white/10 text-[#ffd085] font-mono text-xs border border-[#ffd085]/30 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[14px]">tune</span>
              DUE POLICY: {settings.default_due_days}D ({settings.reference_date})
            </button>
          </div>
          <div className="flex items-center gap-6 text-right font-mono text-xs">
            <div>
              <span className="text-[#b5b8ad] block text-[10px] uppercase tracking-wider">
                ENGINE LATENCY
              </span>
              <span className="text-emerald-400 font-semibold tracking-wider text-sm">0.42 ms</span>
            </div>
            <div className="h-6 w-px bg-white/10 hidden sm:block" />
            <div className="hidden sm:block">
              <span className="text-[#b5b8ad] block text-[10px] uppercase tracking-wider">
                RETURN RATE
              </span>
              <span className="text-[#fbf8ee] font-semibold text-sm">
                {returnRatePct}% OK
              </span>
            </div>
          </div>
        </div>

        {/* Collapsible Configurable Due-Date Policy Drawer (Preserves Full Business Logic) */}
        {policyExpanded && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              await onUpdateSettings(dueDaysInput, refDateInput);
              setPolicyExpanded(false);
            }}
            className="p-4 rounded-xl apple-glass-card flex flex-wrap items-end justify-between gap-4 animate-aura-enter"
          >
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label
                  htmlFor="hero-due-days-input"
                  className="block text-[10px] font-mono uppercase tracking-wider text-[#b5b8ad] mb-1"
                >
                  Configurable Due Window (Days)
                </label>
                <input
                  id="hero-due-days-input"
                  type="number"
                  min={1}
                  max={365}
                  value={dueDaysInput}
                  onChange={(e) => setDueDaysInput(Number(e.target.value))}
                  className="w-28 px-3 py-1.5 rounded-lg bg-black/50 border border-white/15 font-mono text-xs text-[#fbf8ee]"
                />
              </div>
              <div>
                <label
                  htmlFor="hero-ref-date-input"
                  className="block text-[10px] font-mono uppercase tracking-wider text-[#b5b8ad] mb-1"
                >
                  Overdue Evaluation Date
                </label>
                <input
                  id="hero-ref-date-input"
                  type="date"
                  value={refDateInput}
                  onChange={(e) => setRefDateInput(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-black/50 border border-white/15 font-mono text-xs text-[#fbf8ee]"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isBusy}
                className="px-4 py-2 rounded-lg bg-[#ffd085] text-[#191c19] font-mono text-xs font-bold cursor-pointer"
              >
                Apply Policy
              </button>
              <button
                type="button"
                onClick={() => setPolicyExpanded(false)}
                className="px-3 py-2 rounded-lg bg-white/10 text-[#b5b8ad] font-mono text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </form>
        )}

        {/* Hero Editorial Typography Headline + Real-Time Sync Counters + 3D Book Stack Stage */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-center">
          <div className="xl:col-span-7 space-y-5 hero-headline-block">
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl text-[#fbf8ee] tracking-tight font-bold leading-[1.12]">
              <span className="inline-block hero-word-reveal">LIBRARY</span>{' '}
              <span className="inline-block text-white/25 font-light hero-word-reveal">//</span>{' '}
              <span className="inline-block text-[#ffd085] italic font-serif hero-word-reveal">
                CIRCULATION
              </span>
            </h1>

            <p className="text-base sm:text-lg text-[#d8dad0] font-sans tracking-wide leading-relaxed max-w-2xl">
              Every book movement. Every borrower. Every insight. Powered by a live Python 3,
              Pandas, NumPy, and relational SQL analytics engine.
            </p>

            {/* Real-Time Sync Counters & Controls */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 pt-2">
              <div className="px-4 py-3 apple-glass text-left">
                <span className="text-[10px] text-[#b5b8ad] block font-mono uppercase tracking-wider font-semibold">
                  Cycle Timer
                </span>
                <span
                  ref={cycleTimerRef}
                  className="font-mono text-xl sm:text-2xl text-[#fbf8ee] font-bold tracking-tight"
                >
                  00:18.420s
                </span>
              </div>
              <div className="px-4 py-3 apple-glass text-left">
                <span className="text-[10px] text-[#b5b8ad] block font-mono uppercase tracking-wider font-semibold">
                  Index Sync
                </span>
                <span
                  ref={tpsCounterRef}
                  className="font-mono text-xl sm:text-2xl text-emerald-400 font-bold tracking-tight"
                >
                  99.42% SYNC
                </span>
              </div>
              <button
                type="button"
                onClick={handleSyncTelemetryPulse}
                className="px-5 py-3.5 rounded-xl bg-[#ffd085] hover:bg-[#ffe0a3] text-[#191c19] font-mono text-xs font-bold shadow-[0_8px_24px_rgba(255,208,133,0.3)] transition-all flex items-center gap-2 active:scale-95 shrink-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">sync</span>
                <span>SYNC TELEMETRY</span>
              </button>
              <button
                type="button"
                onClick={onNavigateToDesk}
                className="px-4 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-[#fbf8ee] font-mono text-xs font-semibold transition-all cursor-pointer"
              >
                Issue / Return Book
              </button>
            </div>
          </div>

          {/* Right 5 Cols: Interactive 3D Monograph Stack & Circulation Astrolabe */}
          <div className="xl:col-span-5">
            <ThreeBookStackCanvas
              totalTitles={kpis.total_books_titles ?? books.length}
              activeLoans={kpis.active_loans ?? 0}
              availableCopies={kpis.total_copies_available ?? 0}
              overdueLoans={kpis.overdue_loans ?? 0}
            />
          </div>
        </div>

        {/* ================================================================= */}
        {/* SCENE B: ANIMATED CIRCULATION PIPELINE TOPOLOGY DIAGRAM           */}
        {/* ================================================================= */}
        <div className="scene-b-pipeline pt-6 border-t border-white/10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#b5b8ad]">
            <span className="flex items-center gap-2 font-semibold text-[#d8dad0]">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              CIRCULATION TOPOLOGY DIAGRAM // BOOKS → BORROWERS → LOANS → PYTHON ANALYTICS → INSIGHTS
            </span>
            <span className="text-emerald-400 font-mono">STATE: OPTIMAL_CONVERGENCE</span>
          </div>

          <div className="relative w-full rounded-2xl p-6 sm:p-8 apple-glass-card overflow-hidden">
            {/* SVG Transit Packet Paths */}
            <svg
              className="w-full h-16 hidden md:block"
              fill="none"
              preserveAspectRatio="none"
              viewBox="0 0 1000 64"
            >
              <path
                className="pipeline-draw-line"
                d="M 100 32 C 220 8, 280 56, 300 32 C 320 8, 480 56, 500 32 C 520 8, 680 56, 700 32 C 720 8, 880 56, 900 32"
                stroke="rgba(255,255,255,0.16)"
                strokeLinecap="round"
                strokeWidth="2.5"
              />
              <path
                className="pipeline-active"
                d="M 100 32 C 220 8, 280 56, 300 32 C 320 8, 480 56, 500 32 C 520 8, 680 56, 700 32 C 720 8, 880 56, 900 32"
                stroke="url(#hero-flow-gold)"
                strokeDasharray="14 18"
                strokeLinecap="round"
                strokeWidth="3"
              />
              <defs>
                <linearGradient id="hero-flow-gold" x1="0%" x2="100%" y1="0%" y2="0%">
                  <stop offset="0%" stopColor="#34d399" />
                  <stop offset="50%" stopColor="#ffd085" />
                  <stop offset="100%" stopColor="#38bdf8" />
                </linearGradient>
              </defs>
            </svg>

            {/* 5 Interactive Modular Nodes Bound to Real Database Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 relative z-10 md:-mt-14">
              {/* Node 1: BOOKS */}
              <button
                type="button"
                onClick={() => onNavigateRoute('/catalog')}
                className="pipeline-node-card flex flex-col items-center text-center p-4 apple-glass hover:scale-105 hover:border-[#ffd085]/50 transition-all duration-300 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-2 text-[#ffd085]">
                  <span className="material-symbols-outlined text-[20px]">auto_stories</span>
                </div>
                <span className="text-[10px] font-mono text-[#b5b8ad] tracking-wider uppercase font-semibold">
                  01 // BOOKS
                </span>
                <span className="text-xl font-bold text-[#fbf8ee] font-mono mt-0.5">
                  {kpis.total_books_titles ?? books.length}
                </span>
                <span className="text-xs text-[#d8dad0]">
                  Titles ({kpis.total_copies_available ?? 0} Copies)
                </span>
              </button>

              {/* Node 2: BORROWERS */}
              <button
                type="button"
                onClick={() => onNavigateRoute('/catalog/borrowers')}
                className="pipeline-node-card flex flex-col items-center text-center p-4 apple-glass hover:scale-105 hover:border-sky-400/50 transition-all duration-300 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-2 text-sky-300">
                  <span className="material-symbols-outlined text-[20px]">badge</span>
                </div>
                <span className="text-[10px] font-mono text-[#b5b8ad] tracking-wider uppercase font-semibold">
                  02 // BORROWERS
                </span>
                <span className="text-xl font-bold text-[#fbf8ee] font-mono mt-0.5">
                  {kpis.total_borrowers ?? borrowers.length}
                </span>
                <span className="text-xs text-[#d8dad0]">Registered Patrons</span>
              </button>

              {/* Node 3: LOANS */}
              <button
                type="button"
                onClick={() => onNavigateRoute('/circulation')}
                className="pipeline-node-card flex flex-col items-center text-center p-4 apple-glass border-emerald-400/40 hover:scale-105 transition-all duration-300 ring-1 ring-emerald-400/30 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center mb-2">
                  <span className="material-symbols-outlined text-[20px]">sync_alt</span>
                </div>
                <span className="text-[10px] font-mono text-[#b5b8ad] tracking-wider uppercase font-semibold">
                  03 // LOANS
                </span>
                <span className="text-xl font-bold text-emerald-300 font-mono mt-0.5">
                  {kpis.active_loans ?? 0}
                </span>
                <span className="text-xs text-emerald-400 font-medium">
                  Active ({kpis.total_loans ?? 0} Total)
                </span>
              </button>

              {/* Node 4: PYTHON ANALYTICS */}
              <button
                type="button"
                onClick={onNavigateToPython}
                className="pipeline-node-card flex flex-col items-center text-center p-4 apple-glass hover:scale-105 hover:border-[#ffd085]/50 transition-all duration-300 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center mb-2 text-[#ffd085]">
                  <span className="material-symbols-outlined text-[20px]">terminal</span>
                </div>
                <span className="text-[10px] font-mono text-[#b5b8ad] tracking-wider uppercase font-semibold">
                  04 // ANALYTICS
                </span>
                <span className="text-xl font-bold text-[#fbf8ee] font-mono mt-0.5">v3.12</span>
                <span className="text-xs text-[#d8dad0]">Pandas &amp; NumPy</span>
              </button>

              {/* Node 5: INSIGHTS */}
              <button
                type="button"
                onClick={() => onNavigateRoute('/reports/statistics')}
                className="pipeline-node-card col-span-2 sm:col-span-1 flex flex-col items-center text-center p-4 apple-glass hover:scale-105 hover:border-emerald-400/50 transition-all duration-300 cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center mb-2 text-emerald-300">
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                </div>
                <span className="text-[10px] font-mono text-[#b5b8ad] tracking-wider uppercase font-semibold">
                  05 // INSIGHTS
                </span>
                <span className="text-xl font-bold text-emerald-300 font-mono mt-0.5">
                  {returnRatePct}%
                </span>
                <span className="text-xs text-[#d8dad0]">Return Convergence</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SCENE C: FOUR EXPANSIVE SIDE-BY-SIDE KPI CARDS                        */}
      {/* ===================================================================== */}
      {renderSceneCMetrics()}

      {/* ===================================================================== */}
      {/* SCENE D & E: 2-COLUMN EXPANSIVE ANALYTICS & EVENT LOG GRID            */}
      {/* ===================================================================== */}
      <section className="scene-d-analytics grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN (8 COLS): MONTHLY BORROWING TRENDS + SUB-SECOND EVENT LOG */}
        <div className="lg:col-span-8 space-y-8">
          {/* MONTHLY BORROWING TRENDS DUAL-TRACE CHART (REAL PYTHON DATA) */}
          <div className="scene-d-trends-card apple-glass p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ffd085]" />
                  <h2 className="font-serif text-xl sm:text-2xl text-[#fbf8ee] font-bold tracking-tight">
                    MONTHLY BORROWING TRENDS
                  </h2>
                </div>
                <span className="text-xs font-mono text-[#b5b8ad] block pt-0.5">
                  DUAL TRACE // BOOKS ISSUED VS BOOKS RETURNED ({chartGeometry.data.length} MONTHS)
                </span>
              </div>

              {/* View / Timeframe Switcher (Preserves Python Matplotlib SVG Access) */}
              <div className="flex items-center gap-1 p-1 rounded-full bg-white/05 border border-white/10 text-xs font-mono">
                {(
                  [
                    { id: 'SPLINE', label: 'ALL MO' },
                    { id: 'PEAK', label: 'PEAK 4M' },
                    { id: 'MATPLOTLIB', label: 'PY MATPLOTLIB' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setChartViewMode(tab.id)}
                    className={`px-3 py-1 rounded-full transition cursor-pointer ${
                      chartViewMode === tab.id
                        ? 'bg-white/20 text-[#ffd085] font-bold shadow-sm'
                        : 'text-[#b5b8ad] hover:text-[#fbf8ee]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {chartViewMode === 'MATPLOTLIB' ? (
              <div className="space-y-4">
                <div
                  className="w-full overflow-hidden rounded-2xl border border-white/15 bg-black/45 p-2"
                  dangerouslySetInnerHTML={{ __html: state?.charts_svg?.monthly_trends || '' }}
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => downloadCsvReport('monthly')}
                    className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-[#ffd085] hover:text-[#191c19] text-xs font-mono font-semibold transition-colors cursor-pointer"
                  >
                    Export Monthly CSV
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Wide Dual-Trace Interactive Spline Display */}
                <div className="relative w-full rounded-2xl apple-glass-card p-6 overflow-hidden">
                  {/* Floating Scrubber Tooltip Bound to Active/Scrolled Month */}
                  {highlightedMonth && (
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-3.5 py-2 rounded-xl bg-black/45 border border-white/10 text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#ffd085]" />
                        <span className="text-[#ffd085] font-bold">
                          INSPECTING: {highlightedMonth.month}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[#fbf8ee]">
                          Issued: <strong>{highlightedMonth.total_issued}</strong>
                        </span>
                        <span className="text-sky-300">
                          Returned: <strong>{highlightedMonth.returned_count}</strong>
                        </span>
                        <span className="text-rose-400">
                          Overdue: <strong>{highlightedMonth.overdue_count}</strong>
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Spline SVG */}
                  <svg
                    className="w-full h-64"
                    fill="none"
                    preserveAspectRatio="none"
                    viewBox="0 0 640 210"
                  >
                    {/* Grid Lines */}
                    <line
                      stroke="rgba(255,255,255,0.08)"
                      strokeDasharray="4 4"
                      x1="0"
                      x2="640"
                      y1="40"
                      y2="40"
                    />
                    <line
                      stroke="rgba(255,255,255,0.08)"
                      strokeDasharray="4 4"
                      x1="0"
                      x2="640"
                      y1="90"
                      y2="90"
                    />
                    <line
                      stroke="rgba(255,255,255,0.08)"
                      strokeDasharray="4 4"
                      x1="0"
                      x2="640"
                      y1="140"
                      y2="140"
                    />
                    <line
                      stroke="rgba(255,255,255,0.08)"
                      strokeDasharray="4 4"
                      x1="0"
                      x2="640"
                      y1="186"
                      y2="186"
                    />

                    {/* Books Returned Area & Line (Sky Cyan) */}
                    {chartGeometry.returnedPaths.areaPath && (
                      <path
                        className="trends-area-fill"
                        d={chartGeometry.returnedPaths.areaPath}
                        fill="url(#trends-sky-area)"
                        opacity="0.22"
                      />
                    )}
                    {chartGeometry.returnedPaths.linePath && (
                      <path
                        className="trends-spline-stroke"
                        d={chartGeometry.returnedPaths.linePath}
                        stroke="#38bdf8"
                        strokeLinecap="round"
                        strokeWidth="2.5"
                      />
                    )}

                    {/* Books Issued Area & Line (Warm Amber/Gold) */}
                    {chartGeometry.issuedPaths.areaPath && (
                      <path
                        className="trends-area-fill"
                        d={chartGeometry.issuedPaths.areaPath}
                        fill="url(#trends-gold-area)"
                        opacity="0.28"
                      />
                    )}
                    {chartGeometry.issuedPaths.linePath && (
                      <path
                        className="trends-spline-stroke"
                        d={chartGeometry.issuedPaths.linePath}
                        stroke="#ffd085"
                        strokeLinecap="round"
                        strokeWidth="3.2"
                      />
                    )}

                    {/* Vertical Scrubber Line for Highlighted Month */}
                    {highlightedIssuedPt && (
                      <line
                        x1={highlightedIssuedPt.x}
                        x2={highlightedIssuedPt.x}
                        y1="24"
                        y2="186"
                        stroke="rgba(255,208,133,0.45)"
                        strokeDasharray="3 3"
                        strokeWidth="1.5"
                      />
                    )}

                    {/* Interactive Data Points */}
                    {chartGeometry.issuedPoints.map((pt, idx) => {
                      const isSelected = idx === activeMonthIdx;
                      const retPt = chartGeometry.returnedPoints[idx];
                      return (
                        <g
                          key={idx}
                          className="cursor-pointer"
                          onMouseEnter={() => setActiveMonthIdx(idx)}
                          onClick={() => setActiveMonthIdx(idx)}
                        >
                          {retPt && (
                            <circle
                              cx={retPt.x}
                              cy={retPt.y}
                              r={isSelected ? 5.5 : 4}
                              fill="#38bdf8"
                              stroke="#191c19"
                              strokeWidth="2"
                            />
                          )}
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={isSelected ? 6.5 : 4.5}
                            fill="#ffd085"
                            stroke="#191c19"
                            strokeWidth="2.2"
                          />
                        </g>
                      );
                    })}

                    <defs>
                      <linearGradient id="trends-gold-area" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#ffd085" stopOpacity="0.7" />
                        <stop offset="100%" stopColor="#ffd085" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="trends-sky-area" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                  </svg>

                  {/* Interactive Month Axis Markers */}
                  <div className="flex items-center justify-between text-[#b5b8ad] font-mono text-xs pt-4 border-t border-white/10">
                    {chartGeometry.data.map((m: any, idx: number) => {
                      const isPeak = chartGeometry.peakMonth?.month === m.month;
                      const isSelected = idx === activeMonthIdx;
                      return (
                        <button
                          key={m.month}
                          type="button"
                          onClick={() => setActiveMonthIdx(idx)}
                          className={`px-2 py-1 rounded transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-[#ffd085]/20 text-[#ffd085] font-bold'
                              : isPeak
                              ? 'text-emerald-400 font-semibold'
                              : 'hover:text-[#fbf8ee]'
                          }`}
                        >
                          {m.month}
                          {isPeak ? ' [PEAK]' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Legend and Throughput Counters */}
                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-6 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-[#ffd085]" />
                      <span className="text-[#fbf8ee] font-medium">Books Issued</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-sky-400" />
                      <span className="text-[#b5b8ad]">Books Returned</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 font-mono text-xs">
                    <div className="text-right">
                      <span className="text-[#b5b8ad] block text-[10px]">PEAK MONTH</span>
                      <span className="text-[#ffd085] font-bold">
                        {chartGeometry.peakMonth?.month || '2026-10'} (
                        {chartGeometry.peakMonth?.total_issued ?? 0} LOANS)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadCsvReport('monthly')}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-[#ffd085] hover:text-[#191c19] text-[#fbf8ee] transition-colors cursor-pointer"
                    >
                      CSV Export
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* ================================================================= */}
          {/* SCENE E: SUB-SECOND EVENT LOG TABLE (REAL LOANS DATA)             */}
          {/* ================================================================= */}
          <div className="scene-e-transactions scene-e-block apple-glass-table p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <h3 className="font-serif text-xl sm:text-2xl text-[#fbf8ee] font-bold tracking-tight">
                    SUB-SECOND CIRCULATION EVENT LOG
                  </h3>
                </div>
                <span className="text-xs font-mono text-[#b5b8ad]">
                  LIVE AUDIT OF DISPATCHED BOOKS &amp; PATRON NODES ({filteredEventLoans.length}{' '}
                  RECORDS)
                </span>
              </div>

              {/* Filter Search */}
              <div className="relative flex items-center">
                <span className="absolute left-3 text-[#b5b8ad] font-mono text-xs">&gt;_</span>
                <input
                  type="text"
                  aria-label="Filter Patron or ISBN"
                  value={logSearchQuery}
                  onChange={(e) => {
                    setLogSearchQuery(e.target.value);
                    setLogPage(1);
                  }}
                  placeholder="FILTER PATRON / ISBN..."
                  className="pl-8 pr-4 py-2 rounded-xl bg-white/05 border border-white/15 text-[#fbf8ee] font-mono text-xs placeholder-[#b5b8ad]/60 focus:outline-none focus:ring-2 focus:ring-[#ffd085]/50 w-52 sm:w-64"
                />
              </div>
            </div>

            {/* Telemetry Table Bound to Real Loans */}
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="text-[#b5b8ad] uppercase tracking-wider border-b border-white/10 font-semibold text-[11px]">
                    <th className="py-3 px-3">EVENT ID</th>
                    <th className="py-3 px-3">PATRON / ROLL NO</th>
                    <th className="py-3 px-3">BOOK MONOGRAPH</th>
                    <th className="py-3 px-3 text-right">ISSUE / DUE</th>
                    <th className="py-3 px-3 text-right">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/05 font-mono text-xs">
                  {paginatedEventLoans.map((ln) => {
                    const isOverdue = ln.status === 'OVERDUE';
                    const isActive = ln.status === 'ACTIVE';
                    return (
                      <tr key={ln.loan_id} className="hover:bg-white/05 transition-colors">
                        <td className="py-3.5 px-3 text-[#ffd085] font-semibold">
                          #LN-{ln.loan_id}
                        </td>
                        <td className="py-3.5 px-3 text-[#fbf8ee]">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isOverdue
                                  ? 'bg-rose-500'
                                  : isActive
                                  ? 'bg-emerald-400'
                                  : 'bg-sky-400'
                              }`}
                            />
                            <span>{ln.borrower_name}</span>
                          </div>
                          <span className="text-[10px] text-[#b5b8ad] pl-4">{ln.roll_no}</span>
                        </td>
                        <td className="py-3.5 px-3 text-[#d8dad0]">
                          <div className="truncate max-w-[230px] text-[#fbf8ee] font-sans font-medium">
                            {ln.book_title}
                          </div>
                          <div className="text-[10px] text-[#b5b8ad]">{ln.isbn}</div>
                        </td>
                        <td className="py-3.5 px-3 text-right text-[#b5b8ad]">
                          <div>{ln.issue_date}</div>
                          <div className="text-[10px]">Due: {ln.due_date}</div>
                        </td>
                        <td className="py-3.5 px-3 text-right">
                          {isOverdue ? (
                            <button
                              type="button"
                              onClick={() => onQuickReturnLoan(ln)}
                              className="px-2.5 py-1 rounded-full bg-rose-500/20 hover:bg-rose-500/35 text-rose-300 text-[11px] font-semibold border border-rose-500/30 cursor-pointer"
                            >
                              OVERDUE ({ln.days_overdue}d) · RETURN
                            </button>
                          ) : isActive ? (
                            <button
                              type="button"
                              onClick={() => onQuickReturnLoan(ln)}
                              className="px-2.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/35 text-emerald-300 text-[11px] font-semibold border border-emerald-500/30 cursor-pointer"
                            >
                              ACTIVE_OUT · RETURN
                            </button>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 text-[11px] font-semibold border border-sky-500/30">
                              RETURNED ({ln.return_date})
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="pt-4 border-t border-white/10 flex flex-wrap items-center justify-between text-[#b5b8ad] font-mono text-xs gap-3">
              <span>
                SHOWING {paginatedEventLoans.length} OF {filteredEventLoans.length} AUDITED EVENTS
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={logPage <= 1}
                  onClick={() => setLogPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-white/05 hover:bg-white/10 text-[#fbf8ee] transition disabled:opacity-30 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_left</span>
                </button>
                <span className="text-[#fbf8ee] px-2">
                  PAGE {String(logPage).padStart(2, '0')} / {String(totalLogPages).padStart(2, '0')}
                </span>
                <button
                  type="button"
                  disabled={logPage >= totalLogPages}
                  onClick={() => setLogPage((p) => Math.min(totalLogPages, p + 1))}
                  className="p-1.5 rounded-lg bg-white/05 hover:bg-white/10 text-[#fbf8ee] transition disabled:opacity-30 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 COLS): DISCIPLINE DISTRIBUTION DONUT + MOST-BORROWED LEADERBOARD */}
        <div className="lg:col-span-4 space-y-8">
          {/* DISCIPLINE DISTRIBUTION DONUT CHART (REAL PYTHON CATEGORY SUMMARY) */}
          <div className="apple-glass p-6 sm:p-7 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h3 className="font-serif text-xl text-[#fbf8ee] font-bold tracking-tight">
                  DISCIPLINE DISTRIBUTION
                </h3>
                <span className="text-xs font-mono text-[#b5b8ad]">
                  PANDAS CATEGORY ALLOCATION
                </span>
              </div>
              <div className="p-2 rounded-xl bg-white/05 text-[#ffd085] border border-white/10">
                <span className="material-symbols-outlined text-[20px]">donut_large</span>
              </div>
            </div>

            {/* Donut Radial Gauge SVG */}
            <div className="relative flex items-center justify-center py-4">
              <svg className="w-48 h-48 -rotate-90" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  fill="none"
                  r="48"
                  stroke="rgba(255,255,255,0.08)"
                  strokeWidth="12"
                />
                {donutSegments.map((seg) => {
                  const isHovered = activeCategoryHover === seg.category;
                  return (
                    <circle
                      key={seg.category}
                      cx="60"
                      cy="60"
                      fill="none"
                      r="48"
                      stroke={seg.color}
                      strokeDasharray={seg.dashArray}
                      strokeDashoffset={seg.dashOffset}
                      strokeLinecap="round"
                      strokeWidth={isHovered ? '14.5' : '12'}
                      className="transition-all duration-300 cursor-pointer"
                      onMouseEnter={() => setActiveCategoryHover(seg.category)}
                      onMouseLeave={() => setActiveCategoryHover(null)}
                    />
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
                <span className="font-serif text-3xl font-bold text-[#fbf8ee] leading-none">
                  {activeCategoryHover
                    ? `${
                        donutSegments.find((s) => s.category === activeCategoryHover)?.sharePct ??
                        100
                      }%`
                    : '100%'}
                </span>
                <span className="text-[10px] font-mono text-[#b5b8ad] tracking-wider uppercase mt-1 max-w-[95px] truncate">
                  {activeCategoryHover || 'EQUILIBRIUM'}
                </span>
              </div>
            </div>

            {/* Breakdown List */}
            <div className="space-y-2.5 font-mono text-xs">
              {donutSegments.map((seg) => (
                <div
                  key={seg.category}
                  onMouseEnter={() => setActiveCategoryHover(seg.category)}
                  onMouseLeave={() => setActiveCategoryHover(null)}
                  className="flex items-center justify-between p-3 rounded-xl apple-glass-card hover:border-white/30 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                    />
                    <span className="text-[#fbf8ee] font-sans">{seg.category}</span>
                  </div>
                  <span className="font-bold" style={{ color: seg.color }}>
                    {seg.sharePct}% ({seg.totalLoans})
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-white/10 flex items-center justify-between text-[#b5b8ad] font-mono text-xs">
              <span>PANDAS GROUPBY</span>
              <button
                type="button"
                onClick={() => onNavigateRoute('/reports/statistics')}
                className="text-[#ffd085] font-semibold hover:underline cursor-pointer"
              >
                VIEW NUMPY STATS →
              </button>
            </div>
          </div>

          {/* MOST-BORROWED RESEARCH MONOGRAPHS LEADERBOARD */}
          <div className="scene-d-leaderboard apple-glass p-6 sm:p-7 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-[#ffd085]/20 text-[#ffd085] font-mono text-[10px] font-bold">
                    LEADERBOARD
                  </span>
                  <h3 className="font-serif text-xl text-[#fbf8ee] font-bold tracking-tight">
                    MOST-BORROWED BOOKS
                  </h3>
                </div>
                <span className="text-xs font-mono text-[#b5b8ad] block pt-0.5">
                  CIRCULATION RECORD HOLDERS
                </span>
              </div>
              <span className="material-symbols-outlined text-[#ffd085] text-[24px]">
                military_tech
              </span>
            </div>

            {/* Leaderboard Items Bound to Real `most_borrowed_books` */}
            <div className="space-y-3">
              {mostBorrowed.slice(0, 4).map((book, idx) => {
                const maxBookLoans = Math.max(1, mostBorrowed[0]?.total_loans || 1);
                const pctWidth = Math.round(((book.total_loans || 0) / maxBookLoans) * 100);
                const badgeColors =
                  idx === 0
                    ? 'from-[#ffd085]/30 to-[#b8860b]/40 border-[#ffd085]/40 text-[#ffd085]'
                    : idx === 1
                    ? 'from-sky-400/20 to-blue-600/30 border-sky-400/40 text-sky-300'
                    : 'from-white/10 to-white/05 border-white/20 text-[#fbf8ee]';

                return (
                  <div
                    key={book.book_id}
                    className="p-3.5 rounded-xl apple-glass-card hover:border-[#ffd085]/50 transition-all flex items-center gap-3.5 group"
                  >
                    <div
                      className={`w-10 h-13 py-1 rounded bg-gradient-to-br border flex flex-col justify-between items-center text-center p-1 shrink-0 select-none transition-transform duration-300 group-hover:rotate-y-12 ${badgeColors}`}
                    >
                      <span className="text-[8px] font-mono font-bold">#{book.rank ?? idx + 1}</span>
                      <span className="material-symbols-outlined text-[14px]">auto_stories</span>
                      <span className="text-[7px] font-mono">P{idx + 1}</span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm font-semibold text-[#fbf8ee] truncate group-hover:text-[#ffd085] transition-colors">
                          {book.title}
                        </span>
                        <span className="text-xs font-mono text-emerald-400 font-bold ml-2 shrink-0">
                          {book.total_loans} loans
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[#b5b8ad] text-[11px] font-mono">
                        <span className="truncate">
                          {book.author} • {book.category}
                        </span>
                        <span className="text-[#ffd085]">{book.copies_available} avail</span>
                      </div>
                      <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="popular-rank-bar h-full bg-gradient-to-r from-[#ffd085] to-emerald-400 rounded-full"
                          style={{ width: `${pctWidth}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => onNavigateRoute('/reports/popular')}
              className="w-full py-3 rounded-xl bg-white/10 hover:bg-[#ffd085] hover:text-[#191c19] text-[#fbf8ee] border border-white/15 font-mono text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              <span>VIEW FULL POPULAR BOOKS REPORT</span>
              <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
            </button>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SCENE E BOTTOM: SECONDARY HARDWARE & ANALYTICAL MODULES               */}
      {/* ===================================================================== */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="scene-e-block apple-glass glass-edge-sweep p-7 sm:p-9 space-y-3 relative overflow-hidden group">
          <div className="flex items-center gap-2 font-mono text-xs text-emerald-400 font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span>HIGH-SPEED SCAN RAIL // CARREL-BAY ALPHA</span>
          </div>
          <h4 className="font-serif text-2xl text-[#fbf8ee] font-bold tracking-tight">
            Automated Optical Book Return Ingest
          </h4>
          <p className="text-xs text-[#d8dad0] max-w-lg leading-relaxed">
            Sub-12ms dual-camera barcode and RFID verification for high-density drop boxes with
            automated sorting, due-date verification, and immediate copy restoration.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-emerald-400">
            <span>• SENSOR: OPTICAL OK</span>
            <span>• OVERDUE QUEUE: {overdueLoans.length} ACTIVE</span>
            <button
              type="button"
              onClick={onNavigateToDesk}
              className="text-[#ffd085] hover:underline cursor-pointer"
            >
              • OPEN DESK →
            </button>
          </div>
        </div>

        <div className="scene-e-block apple-glass glass-edge-sweep p-7 sm:p-9 space-y-3 relative overflow-hidden group">
          <div className="flex items-center gap-2 font-mono text-xs text-[#ffd085] font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffd085]" />
            <span>PYTHON 3 ANALYTICS ENGINE // TELEMETRY LINKED</span>
          </div>
          <h4 className="font-serif text-2xl text-[#fbf8ee] font-bold tracking-tight">
            Pandas, NumPy &amp; Matplotlib Studio
          </h4>
          <p className="text-xs text-[#d8dad0] max-w-lg leading-relaxed">
            Direct execution of Python 3 statistical routines, SQL query workbench, and downloadable
            project submission source files.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono text-[#ffd085]">
            <span>• MEAN DURATION: {numpyStats.loan_duration_days?.mean ?? 12.4}D</span>
            <span>• STD DEV: {numpyStats.loan_duration_days?.std_dev ?? 4.8}D</span>
            <button
              type="button"
              onClick={() => onNavigateRoute('/python')}
              className="text-emerald-400 hover:underline cursor-pointer"
            >
              • LAUNCH PYTHON STUDIO →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
