import React, { useState, useEffect } from 'react';
import {
  calculateConfigurableDueDate,
  validateIssueTransaction,
  validateReturnTransaction,
  type BookRecord,
  type BorrowerRecord,
  type LoanRecord,
} from '../utils/circulationRules';
import type { AppRoutePath } from '../App';

export type CirculationSubRoute = 'desk' | 'ledger';

interface CirculationDeskProps {
  subRoute: CirculationSubRoute;
  onNavigateRoute: (path: AppRoutePath) => void;
  books: BookRecord[];
  borrowers: BorrowerRecord[];
  loans: LoanRecord[];
  defaultDueDays: number;
  referenceDate: string;
  selectedLoanForReturn: LoanRecord | null;
  onClearSelectedLoan: () => void;
  onIssueBook: (payload: {
    book_id: number;
    borrower_id: number;
    issue_date: string;
    due_date: string;
  }) => Promise<{ ok: boolean; error?: string; message?: string }>;
  onReturnBook: (payload: {
    loan_id: number;
    return_date: string;
  }) => Promise<{ ok: boolean; error?: string; message?: string }>;
  isBusy: boolean;
}

export const CirculationDesk: React.FC<CirculationDeskProps> = ({
  subRoute,
  onNavigateRoute,
  books,
  borrowers,
  loans,
  defaultDueDays,
  referenceDate,
  selectedLoanForReturn,
  onClearSelectedLoan,
  onIssueBook,
  onReturnBook,
  isBusy,
}) => {
  // Issue Form State
  const [issueBookId, setIssueBookId] = useState<number>(books[0]?.book_id || 1);
  const [issueBorrowerId, setIssueBorrowerId] = useState<number>(borrowers[0]?.borrower_id || 1);
  const [issueDate, setIssueDate] = useState<string>(referenceDate);
  const [customDueDays, setCustomDueDays] = useState<number>(defaultDueDays);
  const [dueDate, setDueDate] = useState<string>(() => {
    try {
      return calculateConfigurableDueDate(referenceDate, defaultDueDays);
    } catch {
      return referenceDate;
    }
  });
  const [issueFeedback, setIssueFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Return Form State
  const activeLoans = loans.filter((l) => l.status !== 'RETURNED');
  const [returnLoanId, setReturnLoanId] = useState<number>(
    selectedLoanForReturn?.loan_id || activeLoans[0]?.loan_id || loans[0]?.loan_id || 0
  );
  const [returnDate, setReturnDate] = useState<string>(referenceDate);
  const [returnFeedback, setReturnFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Ledger Filter State
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'OVERDUE' | 'RETURNED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (selectedLoanForReturn) {
      setReturnLoanId(selectedLoanForReturn.loan_id);
      setReturnDate(referenceDate);
    }
  }, [selectedLoanForReturn, referenceDate]);

  const handleIssueDateOrDaysChange = (newIssueDate: string, newDays: number) => {
    setIssueDate(newIssueDate);
    setCustomDueDays(newDays);
    try {
      const computed = calculateConfigurableDueDate(newIssueDate, newDays);
      setDueDate(computed);
    } catch {
      // Keep manual due date if invalid intermediate input
    }
  };

  const handleIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIssueFeedback(null);

    const targetBook = books.find((b) => b.book_id === Number(issueBookId));
    const targetBorrower = borrowers.find((br) => br.borrower_id === Number(issueBorrowerId));

    const clientCheck = validateIssueTransaction({
      book: targetBook,
      borrower: targetBorrower,
      issueDate,
      dueDate,
    });

    if (!clientCheck.valid) {
      setIssueFeedback({ type: 'error', text: clientCheck.error || 'Invalid issue parameters.' });
      return;
    }

    const res = await onIssueBook({
      book_id: Number(issueBookId),
      borrower_id: Number(issueBorrowerId),
      issue_date: issueDate,
      due_date: dueDate,
    });

    if (!res.ok) {
      setIssueFeedback({ type: 'error', text: res.error || 'Failed to issue book.' });
    } else {
      setIssueFeedback({
        type: 'success',
        text: res.message || 'Book issued and copies_available decremented.',
      });
    }
  };

  const handleReturnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReturnFeedback(null);

    const targetLoan = loans.find((l) => l.loan_id === Number(returnLoanId));
    const clientCheck = validateReturnTransaction({
      loan: targetLoan,
      returnDate,
    });

    if (!clientCheck.valid) {
      setReturnFeedback({ type: 'error', text: clientCheck.error || 'Invalid return sequence.' });
      return;
    }

    const res = await onReturnBook({
      loan_id: Number(returnLoanId),
      return_date: returnDate,
    });

    if (!res.ok) {
      setReturnFeedback({ type: 'error', text: res.error || 'Failed to return book.' });
    } else {
      setReturnFeedback({
        type: 'success',
        text: res.message || 'Book returned and copies_available incremented.',
      });
      onClearSelectedLoan();
    }
  };

  const filteredLoans = loans.filter((ln) => {
    if (statusFilter === 'ACTIVE' && ln.status === 'RETURNED') return false;
    if (statusFilter === 'OVERDUE' && ln.status !== 'OVERDUE') return false;
    if (statusFilter === 'RETURNED' && ln.status !== 'RETURNED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = (ln.book_title || '').toLowerCase().includes(q);
      const matchBorrower = (ln.borrower_name || '').toLowerCase().includes(q);
      const matchRoll = (ln.roll_no || '').toLowerCase().includes(q);
      const matchId = `#${ln.loan_id}`.includes(q);
      return matchTitle || matchBorrower || matchRoll || matchId;
    }
    return true;
  });

  if (subRoute === 'ledger') {
    return (
      <section aria-label="Loans Circulation Ledger" className="apple-glass-table p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-5 border-b border-white/10">
          <div>
            <div className="text-xs font-mono text-[#ffd085]">
              ROUTE // /circulation/ledger · Relational SQL Join
            </div>
            <h1 className="mt-1 font-serif text-2xl sm:text-3xl font-bold text-[#fbf8ee]">
              Circulation Transactions Ledger ({filteredLoans.length} records)
            </h1>
            <p className="text-xs text-[#b5b8ad] mt-1">
              Relational join of loans, books, and borrowers tables
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Segmented Filter Control */}
            <div className="flex items-center gap-1 p-1 rounded-full bg-white/05 border border-white/15 font-mono text-xs">
              {(['ALL', 'ACTIVE', 'OVERDUE', 'RETURNED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === st
                      ? 'bg-[#ffd085] text-[#191c19] font-bold'
                      : 'text-[#b5b8ad] hover:text-[#fbf8ee]'
                  }`}
                >
                  {st === 'ALL'
                    ? 'All Loans'
                    : st === 'ACTIVE'
                    ? 'Active Out'
                    : st === 'OVERDUE'
                    ? 'Overdue'
                    : 'Returned'}
                </button>
              ))}
            </div>

            <div className="relative flex items-center">
              <span className="absolute left-3 text-[#b5b8ad] font-mono text-xs">&gt;_</span>
              <input
                type="search"
                aria-label="Search loans ledger"
                placeholder="Search title, borrower, roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-4 py-1.5 rounded-xl bg-white/05 border border-white/15 text-[#fbf8ee] font-mono text-xs placeholder-[#b5b8ad]/60 focus:outline-none focus:ring-2 focus:ring-[#ffd085]/50"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="text-[#b5b8ad] uppercase tracking-wider border-b border-white/10 font-semibold text-[11px]">
                <th className="py-3 px-4">Loan ID</th>
                <th className="py-3 px-4">Book Title &amp; Category</th>
                <th className="py-3 px-4">Borrower &amp; Roll No</th>
                <th className="py-3 px-4 text-right">Issue Date</th>
                <th className="py-3 px-4 text-right">Due Date</th>
                <th className="py-3 px-4 text-right">Return Date</th>
                <th className="py-3 px-4 text-right">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/05">
              {filteredLoans.map((ln) => (
                <tr key={ln.loan_id} className="hover:bg-white/05 transition-colors">
                  <td className="py-3.5 px-4 text-[#ffd085] font-semibold">#{ln.loan_id}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-sans font-semibold text-[#fbf8ee] text-sm">
                      {ln.book_title}
                    </div>
                    <div className="text-[11px] text-[#b5b8ad]">
                      {ln.book_category} · {ln.isbn}
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-sans font-medium text-[#fbf8ee]">{ln.borrower_name}</div>
                    <div className="text-[11px] text-[#b5b8ad]">{ln.roll_no}</div>
                  </td>
                  <td className="py-3.5 px-4 text-right text-[#d8dad0]">{ln.issue_date}</td>
                  <td className="py-3.5 px-4 text-right text-[#d8dad0]">{ln.due_date}</td>
                  <td className="py-3.5 px-4 text-right text-[#d8dad0]">{ln.return_date || '—'}</td>
                  <td className="py-3.5 px-4 text-right font-semibold">
                    {ln.status === 'OVERDUE' ? (
                      <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        OVERDUE ({ln.days_overdue}d)
                      </span>
                    ) : ln.status === 'ACTIVE' ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ACTIVE
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                        RETURNED
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {ln.status !== 'RETURNED' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReturnLoanId(ln.loan_id);
                          setReturnFeedback(null);
                          onNavigateRoute('/circulation');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-[#ffd085] hover:bg-[#ffe0a3] text-[#191c19] font-mono text-xs font-bold transition-colors cursor-pointer"
                      >
                        Select for Return
                      </button>
                    ) : (
                      <span className="text-white/30">Closed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  // Default SubRoute: 'desk' ('/circulation')
  const recentLoans = loans.slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
        {/* Form 1: Issue Book */}
        <section
          aria-label="Issue Book Transaction"
          className="apple-glass glass-edge-sweep p-6 sm:p-8 flex flex-col justify-between"
        >
          <div>
            <div className="text-xs font-mono text-[#ffd085]">
              INSERT INTO loans · UPDATE books SET copies_available = copies_available - 1
            </div>
            <h2 className="mt-1 font-serif text-2xl font-bold text-[#fbf8ee]">
              Record Book Issue Transaction
            </h2>
            <p className="text-xs text-[#b5b8ad] mt-1">
              Validates copy availability (&gt; 0) and enforces due_date &ge; issue_date using the
              configurable due window.
            </p>

            <form id="issue-book-form" onSubmit={handleIssueSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="issue-book-select"
                  className="block text-xs font-mono uppercase tracking-wider text-[#d8dad0] mb-1.5"
                >
                  Select Book Title (Catalog &amp; Shelf Copies)
                </label>
                <select
                  id="issue-book-select"
                  value={issueBookId}
                  onChange={(e) => setIssueBookId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm bg-black/55 text-[#fbf8ee] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd085]/60"
                >
                  {books.map((b) => (
                    <option key={b.book_id} value={b.book_id} className="bg-[#0e1210] text-[#fbf8ee]">
                      [{b.copies_available} avail] {b.title} — {b.author} ({b.isbn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="issue-borrower-select"
                  className="block text-xs font-mono uppercase tracking-wider text-[#d8dad0] mb-1.5"
                >
                  Select Student Borrower (Roll No)
                </label>
                <select
                  id="issue-borrower-select"
                  value={issueBorrowerId}
                  onChange={(e) => setIssueBorrowerId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm bg-black/55 text-[#fbf8ee] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd085]/60"
                >
                  {borrowers.map((br) => (
                    <option
                      key={br.borrower_id}
                      value={br.borrower_id}
                      className="bg-[#0e1210] text-[#fbf8ee]"
                    >
                      {br.borrower_name} — {br.roll_no} ({br.active_loans ?? 0} active)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="issue-date-input"
                    className="block text-xs font-mono uppercase tracking-wider text-[#d8dad0] mb-1.5"
                  >
                    Issue Date
                  </label>
                  <input
                    id="issue-date-input"
                    type="date"
                    value={issueDate}
                    onChange={(e) => handleIssueDateOrDaysChange(e.target.value, customDueDays)}
                    className="w-full px-3 py-2 text-sm font-mono bg-black/55 text-[#fbf8ee] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd085]/60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="issue-due-days-input"
                    className="block text-xs font-mono uppercase tracking-wider text-[#d8dad0] mb-1.5"
                  >
                    Loan Period (Days)
                  </label>
                  <input
                    id="issue-due-days-input"
                    type="number"
                    min={1}
                    max={365}
                    value={customDueDays}
                    onChange={(e) => handleIssueDateOrDaysChange(issueDate, Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-mono bg-black/55 text-[#fbf8ee] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd085]/60"
                  />
                </div>

                <div>
                  <label
                    htmlFor="issue-due-date-input"
                    className="block text-xs font-mono uppercase tracking-wider text-[#d8dad0] mb-1.5"
                  >
                    Calculated Due Date
                  </label>
                  <input
                    id="issue-due-date-input"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono bg-black/55 text-[#fbf8ee] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd085]/60"
                  />
                </div>
              </div>

              {issueFeedback && (
                <div
                  role="alert"
                  data-testid="issue-feedback-banner"
                  className={`p-3.5 rounded-xl border text-xs font-mono flex items-start gap-2 ${
                    issueFeedback.type === 'error'
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {issueFeedback.type === 'error' ? 'warning' : 'check_circle'}
                  </span>
                  <span>{issueFeedback.text}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full py-3 px-5 rounded-xl bg-[#ffd085] hover:bg-[#ffe0a3] text-[#191c19] font-mono text-xs font-bold shadow-[0_8px_24px_rgba(255,208,133,0.28)] transition-all cursor-pointer disabled:opacity-50"
                >
                  Issue Selected Book
                </button>
              </div>
            </form>
          </div>
        </section>

        {/* Form 2: Return Book */}
        <section
          aria-label="Return Book Transaction"
          className="apple-glass glass-edge-sweep p-6 sm:p-8 flex flex-col justify-between"
        >
          <div>
            <div className="text-xs font-mono text-emerald-400">
              UPDATE loans SET return_date = ? · UPDATE books SET copies_available = copies_available + 1
            </div>
            <h2 className="mt-1 font-serif text-2xl font-bold text-[#fbf8ee]">
              Record Book Return Transaction
            </h2>
            <p className="text-xs text-[#b5b8ad] mt-1">
              Updates loan status to RETURNED, rejects return_date earlier than issue_date, and
              restores shelf inventory.
            </p>

            <form id="return-book-form" onSubmit={handleReturnSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="return-loan-select"
                  className="block text-xs font-mono uppercase tracking-wider text-[#d8dad0] mb-1.5"
                >
                  Select Loan Transaction to Return
                </label>
                <select
                  id="return-loan-select"
                  value={returnLoanId}
                  onChange={(e) => setReturnLoanId(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 text-sm bg-black/55 text-[#fbf8ee] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd085]/60"
                >
                  {loans.map((ln) => (
                    <option
                      key={ln.loan_id}
                      value={ln.loan_id}
                      className="bg-[#0e1210] text-[#fbf8ee]"
                    >
                      #{ln.loan_id} [{ln.status}] {ln.book_title} — {ln.borrower_name} (Issued:{' '}
                      {ln.issue_date})
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const chosen = loans.find((l) => l.loan_id === Number(returnLoanId));
                if (!chosen) return null;
                return (
                  <div className="p-3.5 rounded-xl apple-glass-card text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-[#b5b8ad]">Loan Status:</span>
                      <span
                        className={
                          chosen.status === 'OVERDUE'
                            ? 'text-rose-400 font-bold'
                            : chosen.status === 'ACTIVE'
                            ? 'text-emerald-400 font-bold'
                            : 'text-sky-300 font-bold'
                        }
                      >
                        {chosen.status}
                        {chosen.status === 'OVERDUE' ? ` (${chosen.days_overdue}d overdue)` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#b5b8ad]">Issue Date / Due Date:</span>
                      <span className="text-[#fbf8ee]">
                        {chosen.issue_date} &rarr; {chosen.due_date}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#b5b8ad]">Borrower:</span>
                      <span className="text-[#fbf8ee]">
                        {chosen.borrower_name} ({chosen.roll_no})
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label
                  htmlFor="return-date-input"
                  className="block text-xs font-mono uppercase tracking-wider text-[#d8dad0] mb-1.5"
                >
                  Return Date (Must be &ge; Issue Date)
                </label>
                <input
                  id="return-date-input"
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-black/55 text-[#fbf8ee] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd085]/60"
                />
              </div>

              {returnFeedback && (
                <div
                  role="alert"
                  data-testid="return-feedback-banner"
                  className={`p-3.5 rounded-xl border text-xs font-mono flex items-start gap-2 ${
                    returnFeedback.type === 'error'
                      ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                      : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">
                    {returnFeedback.type === 'error' ? 'warning' : 'check_circle'}
                  </span>
                  <span>{returnFeedback.text}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full py-3 px-5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#191c19] font-mono text-xs font-bold shadow-[0_8px_24px_rgba(52,211,153,0.25)] transition-all cursor-pointer disabled:opacity-50"
                >
                  Complete Book Return
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>

      {/* Compact Recent Transactions Strip */}
      <section aria-label="Recent Circulation Activity" className="apple-glass-table p-6 sm:p-8 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <h3 className="font-serif text-xl font-bold text-[#fbf8ee]">
              Latest 5 Circulation Transactions
            </h3>
            <p className="text-xs text-[#b5b8ad] font-mono">
              Quick preview of recent issue &amp; return records
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateRoute('/circulation/ledger')}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-[#ffd085] hover:text-[#191c19] text-[#fbf8ee] border border-white/15 font-mono text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <span>Open Full Transactions Ledger ({loans.length})</span>
            <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="text-[#b5b8ad] uppercase tracking-wider border-b border-white/10 font-semibold text-[11px]">
                <th className="py-3 px-4">Loan ID</th>
                <th className="py-3 px-4">Book Title</th>
                <th className="py-3 px-4">Borrower</th>
                <th className="py-3 px-4 text-right">Issue Date</th>
                <th className="py-3 px-4 text-right">Due Date</th>
                <th className="py-3 px-4 text-right">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/05">
              {recentLoans.map((ln) => (
                <tr key={ln.loan_id} className="hover:bg-white/05">
                  <td className="py-3 px-4 text-[#ffd085] font-semibold">#{ln.loan_id}</td>
                  <td className="py-3 px-4 font-sans font-medium text-[#fbf8ee]">{ln.book_title}</td>
                  <td className="py-3 px-4 text-[#d8dad0]">
                    {ln.borrower_name} ({ln.roll_no})
                  </td>
                  <td className="py-3 px-4 text-right text-[#b5b8ad]">{ln.issue_date}</td>
                  <td className="py-3 px-4 text-right text-[#b5b8ad]">{ln.due_date}</td>
                  <td className="py-3 px-4 text-right font-semibold">
                    {ln.status === 'OVERDUE' ? (
                      <span className="text-rose-400">OVERDUE ({ln.days_overdue}d)</span>
                    ) : ln.status === 'ACTIVE' ? (
                      <span className="text-emerald-400">ACTIVE</span>
                    ) : (
                      <span className="text-sky-300">RETURNED</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {ln.status !== 'RETURNED' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReturnLoanId(ln.loan_id);
                          setReturnFeedback(null);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-[#ffd085] hover:text-[#191c19] text-[#fbf8ee] text-xs font-mono transition-colors cursor-pointer"
                      >
                        Select for Return
                      </button>
                    ) : (
                      <span className="text-white/30">Closed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
