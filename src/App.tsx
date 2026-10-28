/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { CirculationDesk } from './components/CirculationDesk';
import { CatalogAndBorrowers } from './components/CatalogAndBorrowers';
import { PythonStudio } from './components/PythonStudio';
import type { LoanRecord } from './utils/circulationRules';

type ActiveTab = 'analytics' | 'circulation' | 'catalog' | 'python';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('analytics');
  const [appState, setAppState] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isBusy, setIsBusy] = useState<boolean>(false);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [selectedLoanForReturn, setSelectedLoanForReturn] = useState<LoanRecord | null>(null);

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
    setActiveTab('circulation');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'analytics', label: 'Analytics & Reports' },
    { id: 'circulation', label: 'Circulation Desk' },
    { id: 'catalog', label: 'Catalog & Borrowers' },
    { id: 'python', label: 'Python & SQL Studio' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0C0E] text-[#F4F6F8]">
      {/* Strict 3-Zone Top Bar Contract — Carbon & Acid Volt Edition */}
      <header className="bg-[#0B0C0E]/90 backdrop-blur-md border-b border-[#222731] sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
          {/* Zone 1: Single text element wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('analytics');
            }}
            className="text-lg font-extrabold tracking-tight text-[#D2FF00] font-display whitespace-nowrap shrink-0"
          >
            PyLibAnalytics
          </a>

          {/* Zone 2: 4 clean single-line text navigation links */}
          <nav aria-label="Primary Navigation" className="flex items-center gap-6 text-sm font-medium overflow-x-auto">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1.5 border-b-2 transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === item.id
                    ? 'border-[#D2FF00] text-[#F4F6F8] font-semibold'
                    : 'border-transparent text-[#8A94A6] hover:text-[#F4F6F8]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 primary action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleDownloadFullPythonReport}
              className="px-4 py-2 text-xs font-bold text-[#0B0C0E] bg-[#D2FF00] rounded-lg hover:bg-[#b8e600] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Download Python Report
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-8">
        {errorBanner && (
          <div
            role="alert"
            className="mb-6 p-4 bg-[#2A1218] border border-[#FF3B5C]/40 rounded-lg text-sm text-[#FF6B84] flex items-center justify-between"
          >
            <span>{errorBanner}</span>
            <button
              type="button"
              onClick={fetchState}
              className="px-3 py-1 text-xs font-semibold bg-[#13161B] border border-[#FF3B5C]/40 rounded hover:bg-[#1E232B] cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {loading && !appState ? (
          <div className="space-y-6" aria-busy="true" aria-label="Loading Python circulation engine">
            <div className="h-56 bg-[#13161B] border border-[#222731] rounded-xl animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="h-24 bg-[#13161B] border border-[#222731] rounded-xl animate-pulse" />
              <div className="h-24 bg-[#13161B] border border-[#222731] rounded-xl animate-pulse" />
              <div className="h-24 bg-[#13161B] border border-[#222731] rounded-xl animate-pulse" />
              <div className="h-24 bg-[#13161B] border border-[#222731] rounded-xl animate-pulse" />
            </div>
            <div className="h-80 bg-[#13161B] border border-[#222731] rounded-xl animate-pulse" />
          </div>
        ) : (
          <div key={activeTab} className="animate-aura-enter">
            {activeTab === 'analytics' && (
              <AnalyticsDashboard
                state={appState}
                onUpdateSettings={handleUpdateSettings}
                onQuickReturnLoan={handleQuickReturnFromDashboard}
                onNavigateToDesk={() => setActiveTab('circulation')}
                onNavigateToPython={() => setActiveTab('python')}
                isBusy={isBusy}
              />
            )}

            {activeTab === 'circulation' && (
              <CirculationDesk
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

            {activeTab === 'catalog' && (
              <CatalogAndBorrowers
                books={appState?.books || []}
                borrowers={appState?.borrowers || []}
                onAddBook={handleAddBook}
                onAddBorrower={handleAddBorrower}
                isBusy={isBusy}
              />
            )}

            {activeTab === 'python' && (
              <PythonStudio
                onRunCliReport={handleRunCliReport}
                onRunSql={handleRunSql}
                onResetDatabase={handleResetDatabase}
                isBusy={isBusy}
              />
            )}
          </div>
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="bg-[#0B0C0E] border-t border-[#222731] mt-12">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8A94A6]">
          <div>
            Project 5: Library Book Usage Analysis System · Primary Python 3 Backend &amp; Relational SQL Engine
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('python')}
              className="text-[#D2FF00] hover:underline cursor-pointer"
            >
              Inspect Python Source &amp; SQL Schema
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
