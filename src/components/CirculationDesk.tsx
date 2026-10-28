import React, { useState, useEffect } from 'react';
import {
  calculateConfigurableDueDate,
  validateIssueTransaction,
  validateReturnTransaction,
  type BookRecord,
  type BorrowerRecord,
  type LoanRecord,
} from '../utils/circulationRules';
import { AlertCircle, CheckCircle2, Search } from 'lucide-react';

interface CirculationDeskProps {
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

  return (
    <div className="space-y-8">
      {/* Top Split: Issue Book Form + Return Book Form */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Form 1: Issue Book */}
        <section
          aria-label="Issue Book Transaction"
          className="bg-[#13161B] border border-[#242933] rounded-xl p-6 flex flex-col justify-between"
        >
          <div>
            <div className="text-xs font-mono text-[#D2FF00]">
              INSERT INTO loans · UPDATE books SET copies_available = copies_available - 1
            </div>
            <h2 className="mt-1 text-lg font-bold text-[#F4F6F8]">
              Record Book Issue Transaction
            </h2>
            <p className="text-xs text-[#8A94A6] mt-1">
              Validates copy availability (&gt; 0) and enforces due_date &ge; issue_date using the configurable due window.
            </p>

            <form id="issue-book-form" onSubmit={handleIssueSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="issue-book-select" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Select Book Title (Catalog &amp; Shelf Copies)
                </label>
                <select
                  id="issue-book-select"
                  value={issueBookId}
                  onChange={(e) => setIssueBookId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
                >
                  {books.map((b) => (
                    <option key={b.book_id} value={b.book_id}>
                      [{b.copies_available} avail] {b.title} — {b.author} ({b.isbn})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="issue-borrower-select" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Select Student Borrower (Roll No)
                </label>
                <select
                  id="issue-borrower-select"
                  value={issueBorrowerId}
                  onChange={(e) => setIssueBorrowerId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
                >
                  {borrowers.map((br) => (
                    <option key={br.borrower_id} value={br.borrower_id}>
                      {br.borrower_name} — {br.roll_no} ({br.active_loans ?? 0} active)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="issue-date-input" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Issue Date
                  </label>
                  <input
                    id="issue-date-input"
                    type="date"
                    value={issueDate}
                    onChange={(e) => handleIssueDateOrDaysChange(e.target.value, customDueDays)}
                    className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
                  />
                </div>

                <div>
                  <label htmlFor="issue-due-days-input" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Loan Period (Days)
                  </label>
                  <input
                    id="issue-due-days-input"
                    type="number"
                    min={1}
                    max={365}
                    value={customDueDays}
                    onChange={(e) => handleIssueDateOrDaysChange(issueDate, Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
                  />
                </div>

                <div>
                  <label htmlFor="issue-due-date-input" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Calculated Due Date
                  </label>
                  <input
                    id="issue-due-date-input"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
                  />
                </div>
              </div>

              {issueFeedback && (
                <div
                  role="alert"
                  data-testid="issue-feedback-banner"
                  className={`p-3 rounded-md border text-xs flex items-start gap-2 ${
                    issueFeedback.type === 'error'
                      ? 'bg-[#2A1218] border-[#FF3B5C]/40 text-[#FF6B84]'
                      : 'bg-[#172308] border-[#D2FF00]/40 text-[#D2FF00]'
                  }`}
                >
                  {issueFeedback.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-[#FF3B5C] shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[#D2FF00] shrink-0 mt-0.5" />
                  )}
                  <span>{issueFeedback.text}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full py-2.5 px-4 text-xs font-bold text-[#0B0C0E] bg-[#D2FF00] hover:bg-[#b8e600] rounded-md transition-colors cursor-pointer disabled:opacity-50"
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
          className="bg-[#13161B] border border-[#242933] rounded-xl p-6 flex flex-col justify-between"
        >
          <div>
            <div className="text-xs font-mono text-[#D2FF00]">
              UPDATE loans SET return_date = ? · UPDATE books SET copies_available = copies_available + 1
            </div>
            <h2 className="mt-1 text-lg font-bold text-[#F4F6F8]">
              Record Book Return Transaction
            </h2>
            <p className="text-xs text-[#8A94A6] mt-1">
              Updates loan status to RETURNED, rejects return_date earlier than issue_date, and restores shelf inventory.
            </p>

            <form id="return-book-form" onSubmit={handleReturnSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="return-loan-select" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Select Loan Transaction to Return
                </label>
                <select
                  id="return-loan-select"
                  value={returnLoanId}
                  onChange={(e) => setReturnLoanId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
                >
                  {loans.map((ln) => (
                    <option key={ln.loan_id} value={ln.loan_id}>
                      #{ln.loan_id} [{ln.status}] {ln.book_title} — {ln.borrower_name} (Issued: {ln.issue_date})
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const chosen = loans.find((l) => l.loan_id === Number(returnLoanId));
                if (!chosen) return null;
                return (
                  <div className="py-3 border-y border-[#222731] text-xs space-y-1.5 font-mono">
                    <div className="flex justify-between">
                      <span className="text-[#8A94A6]">Loan Status:</span>
                      <span
                        className={
                          chosen.status === 'OVERDUE'
                            ? 'text-[#FF3B5C] font-semibold'
                            : chosen.status === 'ACTIVE'
                            ? 'text-[#D2FF00] font-semibold'
                            : 'text-[#94A3B8] font-semibold'
                        }
                      >
                        {chosen.status}
                        {chosen.status === 'OVERDUE' ? ` (${chosen.days_overdue}d overdue)` : ''}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8A94A6]">Issue Date / Due Date:</span>
                      <span className="text-[#F4F6F8]">
                        {chosen.issue_date} &rarr; {chosen.due_date}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#8A94A6]">Borrower:</span>
                      <span className="text-[#F4F6F8]">
                        {chosen.borrower_name} ({chosen.roll_no})
                      </span>
                    </div>
                  </div>
                );
              })()}

              <div>
                <label htmlFor="return-date-input" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Return Date (Must be &ge; Issue Date)
                </label>
                <input
                  id="return-date-input"
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
                />
              </div>

              {returnFeedback && (
                <div
                  role="alert"
                  data-testid="return-feedback-banner"
                  className={`p-3 rounded-md border text-xs flex items-start gap-2 ${
                    returnFeedback.type === 'error'
                      ? 'bg-[#2A1218] border-[#FF3B5C]/40 text-[#FF6B84]'
                      : 'bg-[#172308] border-[#D2FF00]/40 text-[#D2FF00]'
                  }`}
                >
                  {returnFeedback.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-[#FF3B5C] shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[#D2FF00] shrink-0 mt-0.5" />
                  )}
                  <span>{returnFeedback.text}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full py-2.5 px-4 text-xs font-bold text-[#0B0C0E] bg-[#F4F6F8] hover:bg-white rounded-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  Complete Book Return
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>

      {/* Full Loans Transaction Ledger */}
      <section aria-label="Loans Circulation Ledger" className="bg-[#13161B] border border-[#242933] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#222731] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#F4F6F8]">
              Circulation Transactions Ledger ({filteredLoans.length} records)
            </h2>
            <p className="text-xs text-[#8A94A6]">
              Relational join of loans, books, and borrowers tables
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Segmented Filter Control */}
            <div className="flex items-center gap-1 p-1 bg-[#0B0C0E] border border-[#222731] rounded-lg">
              {(['ALL', 'ACTIVE', 'OVERDUE', 'RETURNED'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    statusFilter === st
                      ? 'bg-[#D2FF00] text-[#0B0C0E]'
                      : 'text-[#8A94A6] hover:text-[#F4F6F8]'
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

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8A94A6] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                aria-label="Search loans ledger"
                placeholder="Search title, borrower, roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#222731] bg-[#0E1116] text-xs font-semibold text-[#8A94A6]">
                <th className="py-2.5 px-4 whitespace-nowrap">Loan ID</th>
                <th className="py-2.5 px-4">Book Title &amp; Category</th>
                <th className="py-2.5 px-4">Borrower &amp; Roll No</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Issue Date</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Due Date</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Return Date</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Status</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222731] text-sm">
              {filteredLoans.map((ln) => (
                <tr key={ln.loan_id} className="hover:bg-[#191D24] transition-colors">
                  <td className="py-2.5 px-4 font-mono text-xs text-[#94A3B8] tabular-nums whitespace-nowrap">
                    #{ln.loan_id}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-[#F4F6F8]">{ln.book_title}</div>
                    <div className="text-xs text-[#8A94A6]">
                      {ln.book_category} · <span className="font-mono">{ln.isbn}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-[#F4F6F8]">{ln.borrower_name}</div>
                    <div className="text-xs font-mono text-[#8A94A6]">{ln.roll_no}</div>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs text-[#94A3B8] tabular-nums whitespace-nowrap">
                    {ln.issue_date}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs text-[#94A3B8] tabular-nums whitespace-nowrap">
                    {ln.due_date}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs text-[#94A3B8] tabular-nums whitespace-nowrap">
                    {ln.return_date || '—'}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap">
                    {ln.status === 'OVERDUE' ? (
                      <span className="text-[#FF3B5C]">OVERDUE ({ln.days_overdue}d)</span>
                    ) : ln.status === 'ACTIVE' ? (
                      <span className="text-[#D2FF00]">ACTIVE</span>
                    ) : (
                      <span className="text-[#94A3B8]">RETURNED</span>
                    )}
                  </td>
                  <td className="py-2.5 px-4 text-right whitespace-nowrap">
                    {ln.status !== 'RETURNED' ? (
                      <button
                        type="button"
                        onClick={() => {
                          setReturnLoanId(ln.loan_id);
                          setReturnFeedback(null);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-2.5 py-1 text-xs font-semibold text-[#F4F6F8] bg-[#1C2129] hover:bg-[#262C36] border border-[#2D3440] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Select for Return
                      </button>
                    ) : (
                      <span className="text-xs text-[#475569] font-mono">Closed</span>
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
