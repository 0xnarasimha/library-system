import React, { useState, useEffect } from 'react';
import { RefreshCw, ArrowUpRight, Layers } from 'lucide-react';

interface CirculationMotionBannerProps {
  state: any;
  onUpdateSettings: (dueDays: number, referenceDate: string) => Promise<void>;
  onNavigateToDesk: () => void;
  onNavigateToPython: () => void;
  isBusy: boolean;
}

export const CirculationMotionBanner: React.FC<CirculationMotionBannerProps> = ({
  state,
  onUpdateSettings,
  onNavigateToDesk,
  onNavigateToPython,
  isBusy,
}) => {
  const settings = state?.settings || { default_due_days: 14, reference_date: '2026-10-28' };
  const [dueDaysInput, setDueDaysInput] = useState<number>(settings.default_due_days);
  const [refDateInput, setRefDateInput] = useState<string>(settings.reference_date);

  useEffect(() => {
    setDueDaysInput(settings.default_due_days);
    setRefDateInput(settings.reference_date);
  }, [settings.default_due_days, settings.reference_date]);

  const kpis = state?.kpis || {};
  const totalLoans = kpis.total_loans ?? 26;
  const activeLoans = kpis.active_loans ?? 6;
  const overdueLoans = kpis.overdue_loans ?? 4;
  const returnedLoans = kpis.returned_loans ?? 20;
  const availCopies = kpis.total_copies_available ?? 25;
  const totalInventory = availCopies + activeLoans;

  const availabilityPct =
    totalInventory > 0 ? Math.round((availCopies / totalInventory) * 100) : 100;
  const returnRatePct =
    totalLoans > 0 ? Math.round(((totalLoans - overdueLoans) / totalLoans) * 100) : 100;
  const overdueRatePct = Math.round(kpis.overdue_rate_pct ?? 0);

  const handleApplyConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateSettings(Number(dueDaysInput), refDateInput);
  };

  const radius = 29;
  const circumference = 2 * Math.PI * radius;

  return (
    <section
      aria-label="Circulation Analytics Configuration and Motion Topology"
      className="animate-aura-enter relative overflow-hidden rounded-2xl bg-[#111419] text-[#F4F6F8] border border-[#242933] shadow-2xl"
    >
      {/* Top Acid Volt Racing Telemetry Accent Line */}
      <div className="inset-x-0 top-0 h-1 absolute bg-gradient-to-r from-[#D2FF00] via-[#D2FF00]/60 to-transparent" />

      {/* Topographic Contour Lines & Carbon Grid Backdrop (LN4 Aesthetic) */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 w-full h-full opacity-25"
        viewBox="0 0 1200 420"
        preserveAspectRatio="none"
      >
        <defs>
          <radialGradient id="voltGlow" cx="20%" cy="25%" r="55%">
            <stop offset="0%" stopColor="#D2FF00" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#D2FF00" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1200" height="420" fill="url(#voltGlow)" />
        <path
          d="M -100 320 C 220 140, 480 410, 820 180 C 1020 50, 1150 240, 1300 90"
          fill="none"
          stroke="#D2FF00"
          strokeOpacity="0.22"
          strokeWidth="1.2"
        />
        <path
          d="M -100 370 C 260 190, 520 450, 860 220 C 1060 90, 1180 280, 1300 140"
          fill="none"
          stroke="#D2FF00"
          strokeOpacity="0.14"
          strokeWidth="1"
        />
        <path
          d="M -80 80 C 310 260, 640 -40, 980 160 C 1120 240, 1210 110, 1320 210"
          fill="none"
          stroke="#94A3B8"
          strokeOpacity="0.14"
          strokeWidth="1"
        />
      </svg>

      <div className="relative z-10 p-6 lg:p-8 space-y-7">
        {/* Top Row: Editorial Header + Interactive Python Pipeline Topology Motion Graphic */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left 7 Cols: Title, Metadata & Quick Actions */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#D2FF00] tracking-wide">
              <span>{state?.engine?.runtime || 'Python 3.10.12'}</span>
              <span aria-hidden="true" className="text-[#475569]">·</span>
              <span className="text-[#E2E8F0]">SQLite3 / MySQL Relational Engine</span>
              <span aria-hidden="true" className="text-[#475569]">·</span>
              <span className="text-[#94A3B8]">Pandas &amp; NumPy Telemetry Pipeline</span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#F4F6F8] font-display leading-tight text-balance">
              Library Book Usage &amp; Circulation Telemetry
            </h1>

            <p className="text-sm text-[#94A3B8] max-w-2xl leading-relaxed">
              High-precision relational circulation tracking across{' '}
              <span className="text-[#D2FF00] font-mono font-semibold">{kpis.total_books_titles ?? 10}</span>{' '}
              catalog titles and{' '}
              <span className="text-[#F4F6F8] font-mono font-semibold">{kpis.total_borrowers ?? 8}</span>{' '}
              registered borrowers. Every issue, return validation, due-date window calculation, and statistical distribution executes natively in Python 3.
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={onNavigateToDesk}
                className="px-4 py-2 text-xs font-bold text-[#0B0C0E] bg-[#D2FF00] hover:bg-[#b8e600] rounded-lg transition-all duration-150 hover:-translate-y-0.5 flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Issue or Return Book
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onNavigateToPython}
                className="px-4 py-2 text-xs font-semibold text-[#F4F6F8] bg-[#181C23] hover:bg-[#222731] border border-[#2D3440] rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-[#D2FF00]" />
                Inspect Python &amp; SQL Source
              </button>
            </div>
          </div>

          {/* Right 5 Cols: Animated SVG Data-Flow & Radial Telemetry Motion Graphic */}
          <div className="lg:col-span-5">
            <div className="rounded-xl bg-[#0B0C0E]/90 border border-[#242933] p-4 backdrop-blur-sm shadow-lg">
              <div className="mb-2.5 flex items-center justify-between text-[11px] font-mono text-[#8A94A6]">
                <span>PYTHON RELATIONAL STREAM TOPOLOGY</span>
                <span className="text-[#D2FF00] tabular-nums">REF: {settings.reference_date}</span>
              </div>

              <svg
                viewBox="0 0 420 112"
                className="w-full h-auto overflow-visible"
                role="img"
                aria-label="Animated Python Library Circulation Data Pipeline"
              >
                <defs>
                  <linearGradient id="streamVolt" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#D2FF00" stopOpacity="0.2" />
                    <stop offset="50%" stopColor="#D2FF00" stopOpacity="1" />
                    <stop offset="100%" stopColor="#D2FF00" stopOpacity="0.3" />
                  </linearGradient>
                  <linearGradient id="streamAlert" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#D2FF00" stopOpacity="0.3" />
                    <stop offset="50%" stopColor="#FF3B5C" stopOpacity="1" />
                    <stop offset="100%" stopColor="#FF3B5C" stopOpacity="0.8" />
                  </linearGradient>
                </defs>

                {/* Base Connecting Bezier Curves */}
                <path d="M 95 34 C 135 34, 140 55, 172 55" fill="none" stroke="#1E232B" strokeWidth="2.5" />
                <path d="M 95 78 C 135 78, 140 55, 172 55" fill="none" stroke="#1E232B" strokeWidth="2.5" />
                <path d="M 258 55 C 292 55, 296 34, 328 34" fill="none" stroke="#1E232B" strokeWidth="2.5" />
                <path d="M 258 55 C 292 55, 296 78, 328 78" fill="none" stroke="#1E232B" strokeWidth="2.5" />

                {/* Animated Flowing Energy Pulses */}
                <path d="M 95 34 C 135 34, 140 55, 172 55" fill="none" stroke="url(#streamVolt)" strokeWidth="2.5" className="animate-stream-flow" />
                <path d="M 95 78 C 135 78, 140 55, 172 55" fill="none" stroke="url(#streamVolt)" strokeWidth="2.5" className="animate-stream-flow-slow" />
                <path d="M 258 55 C 292 55, 296 34, 328 34" fill="none" stroke="url(#streamVolt)" strokeWidth="2.5" className="animate-stream-flow" />
                <path d="M 258 55 C 292 55, 296 78, 328 78" fill="none" stroke="url(#streamAlert)" strokeWidth="2.5" className="animate-stream-flow-slow" />

                {/* Travelling Data Packets along Bezier Paths */}
                <circle r="3.2" fill="#D2FF00">
                  <animateMotion dur="1.9s" repeatCount="indefinite" path="M 95 34 C 135 34, 140 55, 172 55" />
                </circle>
                <circle r="3.2" fill="#D2FF00">
                  <animateMotion dur="1.8s" repeatCount="indefinite" path="M 258 55 C 292 55, 296 34, 328 34" />
                </circle>
                <circle r="3.2" fill="#FF3B5C">
                  <animateMotion dur="2.2s" repeatCount="indefinite" path="M 258 55 C 292 55, 296 78, 328 78" />
                </circle>

                {/* Left Nodes: books & borrowers */}
                <g transform="translate(6, 14)">
                  <rect width="89" height="38" rx="6" fill="#13161B" stroke="#282E3A" strokeWidth="1.2" />
                  <text x="10" y="16" fill="#8A94A6" fontFamily="JetBrains Mono, monospace" fontSize="9.5">
                    TABLE: books
                  </text>
                  <text x="10" y="30" fill="#D2FF00" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="700">
                    {availCopies} avail
                  </text>
                </g>

                <g transform="translate(6, 58)">
                  <rect width="89" height="38" rx="6" fill="#13161B" stroke="#282E3A" strokeWidth="1.2" />
                  <text x="10" y="16" fill="#8A94A6" fontFamily="JetBrains Mono, monospace" fontSize="9.5">
                    borrowers
                  </text>
                  <text x="10" y="30" fill="#F4F6F8" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="700">
                    {kpis.total_borrowers ?? 8} students
                  </text>
                </g>

                {/* Center Node: Python 3 Engine */}
                <g transform="translate(172, 27)">
                  <rect width="86" height="56" rx="8" fill="#13161B" stroke="#D2FF00" strokeWidth="1.6" />
                  <text x="43" y="21" textAnchor="middle" fill="#D2FF00" fontFamily="JetBrains Mono, monospace" fontSize="10" fontWeight="700">
                    PYTHON 3.10
                  </text>
                  <text x="43" y="35" textAnchor="middle" fill="#F4F6F8" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="9.5" fontWeight="600">
                    Pandas · NumPy
                  </text>
                  <text x="43" y="47" textAnchor="middle" fill="#8A94A6" fontFamily="JetBrains Mono, monospace" fontSize="8.5">
                    Due: {settings.default_due_days}d
                  </text>
                </g>

                {/* Right Nodes: Returned & Overdue */}
                <g transform="translate(328, 14)">
                  <rect width="86" height="38" rx="6" fill="#13161B" stroke="#282E3A" strokeWidth="1.2" />
                  <text x="10" y="16" fill="#8A94A6" fontFamily="JetBrains Mono, monospace" fontSize="9.5">
                    RETURNED
                  </text>
                  <text x="10" y="30" fill="#D2FF00" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="700">
                    {returnedLoans} loans
                  </text>
                </g>

                <g transform="translate(328, 58)">
                  <rect width="86" height="38" rx="6" fill="#13161B" stroke="#282E3A" strokeWidth="1.2" />
                  <text x="10" y="16" fill="#8A94A6" fontFamily="JetBrains Mono, monospace" fontSize="9.5">
                    OVERDUE
                  </text>
                  <text x="10" y="30" fill="#FF3B5C" fontFamily="JetBrains Mono, monospace" fontSize="11" fontWeight="700">
                    {overdueLoans} alert
                  </text>
                </g>
              </svg>

              {/* 3 Radial Velocity Gauges */}
              <div className="mt-3 pt-3 border-t border-[#222731] grid grid-cols-3 gap-2 text-center">
                {[
                  {
                    label: 'Shelf Stock',
                    pct: availabilityPct,
                    color: '#D2FF00',
                    sub: `${availCopies}/${totalInventory} copies`,
                  },
                  {
                    label: 'Compliance',
                    pct: returnRatePct,
                    color: '#F4F6F8',
                    sub: `${totalLoans - overdueLoans}/${totalLoans} loans`,
                  },
                  {
                    label: 'Overdue Share',
                    pct: overdueRatePct,
                    color: '#FF3B5C',
                    sub: `${overdueLoans}/${activeLoans} active`,
                  },
                ].map((gauge) => {
                  const dashOffset =
                    circumference - (Math.min(100, Math.max(0, gauge.pct)) / 100) * circumference;
                  return (
                    <div key={gauge.label} className="flex flex-col items-center">
                      <div className="relative w-16 h-16 flex items-center justify-center">
                        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 72 72">
                          <circle
                            cx="36"
                            cy="36"
                            r={radius}
                            fill="none"
                            stroke="#1E232B"
                            strokeWidth="5"
                          />
                          <circle
                            cx="36"
                            cy="36"
                            r={radius}
                            fill="none"
                            stroke={gauge.color}
                            strokeWidth="5"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashOffset}
                            style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.16, 1, 0.3, 1)' }}
                          />
                        </svg>
                        <span className="absolute text-xs font-mono font-bold text-[#F4F6F8] tabular-nums">
                          {gauge.pct}%
                        </span>
                      </div>
                      <span className="mt-1 text-[11px] font-medium text-[#E2E8F0]">
                        {gauge.label}
                      </span>
                      <span className="text-[10px] font-mono text-[#8A94A6] tabular-nums">
                        {gauge.sub}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Control Strip: Configurable Due Date & Reference Evaluation Date */}
        <form
          onSubmit={handleApplyConfig}
          className="pt-5 border-t border-[#222731] flex flex-col sm:flex-row sm:items-end justify-between gap-4"
        >
          <div className="space-y-0.5">
            <div className="text-xs font-semibold text-[#F4F6F8]">
              Configurable Due-Date Policy &amp; Overdue Reference Engine
            </div>
            <div className="text-xs text-[#8A94A6]">
              Modify the loan period or evaluation date to recompute overdue loans and Pandas/NumPy metrics in real time.
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 shrink-0">
            <div>
              <label htmlFor="config-due-days" className="block text-xs font-medium text-[#94A3B8] mb-1">
                Default Due Window (Days)
              </label>
              <input
                id="config-due-days"
                type="number"
                min={1}
                max={365}
                value={dueDaysInput}
                onChange={(e) => setDueDaysInput(Number(e.target.value))}
                className="w-28 px-3 py-1.5 text-sm font-mono tabular-nums bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
              />
            </div>

            <div>
              <label htmlFor="config-ref-date" className="block text-xs font-medium text-[#94A3B8] mb-1">
                Overdue Evaluation Date
              </label>
              <input
                id="config-ref-date"
                type="date"
                value={refDateInput}
                onChange={(e) => setRefDateInput(e.target.value)}
                className="px-3 py-1.5 text-sm font-mono tabular-nums bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
              />
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="px-4 py-2 text-xs font-bold text-[#0B0C0E] bg-[#D2FF00] hover:bg-[#b8e600] rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
              Apply Due Policy
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
