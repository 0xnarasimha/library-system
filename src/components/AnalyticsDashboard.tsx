import React from 'react';
import { Download, CheckCircle2, AlertTriangle } from 'lucide-react';
import { CirculationMotionBanner } from './CirculationMotionBanner';
import type { BookRecord, LoanRecord } from '../utils/circulationRules';

interface AnalyticsDashboardProps {
  state: any;
  onUpdateSettings: (dueDays: number, referenceDate: string) => Promise<void>;
  onQuickReturnLoan: (loan: LoanRecord) => void;
  onNavigateToDesk: () => void;
  onNavigateToPython: () => void;
  isBusy: boolean;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  state,
  onUpdateSettings,
  onQuickReturnLoan,
  onNavigateToDesk,
  onNavigateToPython,
  isBusy,
}) => {
  const settings = state?.settings || { default_due_days: 14, reference_date: '2026-10-28' };
  const kpis = state?.kpis || {};
  const reports = state?.reports || {};
  const mostBorrowed: BookRecord[] = reports.most_borrowed_books || [];
  const overdueLoans: LoanRecord[] = reports.overdue_loans || [];
  const monthlyTrends: any[] = reports.monthly_trends || [];
  const categorySummary: any[] = reports.category_summary || [];
  const numpyStats = reports.numpy_stats || {};

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

  return (
    <div className="space-y-8">
      {/* Motion Graphics Hero & Configurable Due Policy Banner */}
      <CirculationMotionBanner
        state={state}
        onUpdateSettings={onUpdateSettings}
        onNavigateToDesk={onNavigateToDesk}
        onNavigateToPython={onNavigateToPython}
        isBusy={isBusy}
      />

      {/* 4-Column Staggered KPI Summary Strip — Dark Carbon & Acid Volt */}
      <section aria-label="Circulation Summary Metrics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: 'Total Circulation Loans',
            value: kpis.total_loans ?? 0,
            testId: 'kpi-total-loans',
            valueClass: 'text-[#F4F6F8]',
            subLeft: `${kpis.returned_loans ?? 0} Returned`,
            subRight: `${kpis.total_borrowers ?? 0} Borrowers`,
            accentBar: 'from-[#D2FF00] to-[#99BD00]',
          },
          {
            title: 'Active Loans Out',
            value: kpis.active_loans ?? 0,
            testId: 'kpi-active-loans',
            valueClass: 'text-[#D2FF00]',
            subLeft: `${(kpis.active_loans ?? 0) - (kpis.overdue_loans ?? 0)} On-time`,
            subRight: `Due window: ${settings.default_due_days}d`,
            accentBar: 'from-[#D2FF00] to-transparent',
          },
          {
            title: 'Overdue Loans Count',
            value: kpis.overdue_loans ?? 0,
            testId: 'kpi-overdue-loans',
            valueClass: 'text-[#FF3B5C]',
            subLeft: `${kpis.overdue_rate_pct ?? 0}% of active loans past due`,
            subRight: '',
            isAlert: true,
            accentBar: 'from-[#FF3B5C] to-transparent',
          },
          {
            title: 'Available Shelf Copies',
            value: kpis.total_copies_available ?? 0,
            testId: 'kpi-available-copies',
            valueClass: 'text-[#F4F6F8]',
            subLeft: `Across ${kpis.total_books_titles ?? 0} catalog titles`,
            subRight: '',
            accentBar: 'from-[#64748B] to-transparent',
          },
        ].map((card) => (
          <div
            key={card.title}
            className="animate-aura-delay-1 relative overflow-hidden bg-[#13161B] border border-[#242933] hover:border-[#D2FF00]/50 rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5"
          >
            <div className={`inset-x-0 top-0 h-0.5 absolute bg-gradient-to-r ${card.accentBar}`} />
            <div className="text-xs font-semibold text-[#8A94A6]">{card.title}</div>
            <div
              data-testid={card.testId}
              className={`mt-2 text-3xl font-bold font-mono tabular-nums ${card.valueClass}`}
            >
              {card.value}
            </div>
            <div className="mt-2 text-xs text-[#8A94A6] flex items-center gap-1.5">
              {card.isAlert && <AlertTriangle className="w-3.5 h-3.5 text-[#FF3B5C] shrink-0" />}
              <span>{card.subLeft}</span>
              {card.subRight && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{card.subRight}</span>
                </>
              )}
            </div>
          </div>
        ))}
      </section>

      {/* Matplotlib Visual Charts Grid (Generated by Python) */}
      <section aria-label="Matplotlib Borrowing Trends and Popular Books Charts" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="animate-aura-delay-2 bg-[#13161B] border border-[#242933] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h2 className="text-base font-bold text-[#F4F6F8]">
                Monthly Circulation Chart
              </h2>
              <p className="text-xs text-[#8A94A6]">
                Python Matplotlib SVG plot of monthly issue volume, returns, and overdue loans
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadCsvReport('monthly')}
              className="px-3 py-1.5 text-xs font-medium text-[#F4F6F8] bg-[#1C2129] hover:bg-[#262C36] border border-[#2D3440] rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#D2FF00]" />
              Download CSV
            </button>
          </div>
          <div
            className="w-full overflow-hidden border border-[#222731] rounded-lg bg-[#101318]"
            dangerouslySetInnerHTML={{ __html: state?.charts_svg?.monthly_trends || '' }}
          />
        </div>

        <div className="animate-aura-delay-2 bg-[#13161B] border border-[#242933] rounded-xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h2 className="text-base font-bold text-[#F4F6F8]">
                Popular-Book Circulation Chart
              </h2>
              <p className="text-xs text-[#8A94A6]">
                Python Matplotlib horizontal ranking of most-borrowed library titles
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadCsvReport('popular')}
              className="px-3 py-1.5 text-xs font-medium text-[#F4F6F8] bg-[#1C2129] hover:bg-[#262C36] border border-[#2D3440] rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#D2FF00]" />
              Download CSV
            </button>
          </div>
          <div
            className="w-full overflow-hidden border border-[#222731] rounded-lg bg-[#101318]"
            dangerouslySetInnerHTML={{ __html: state?.charts_svg?.popular_books || '' }}
          />
        </div>
      </section>

      {/* Overdue-Loan List (Expected Output #2) */}
      <section
        aria-label="Overdue Loans Report"
        className="animate-aura-delay-3 bg-[#13161B] border border-[#242933] rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#222731] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#F4F6F8]">
              Overdue-Loan Watchlist (As of {settings.reference_date})
            </h2>
            <p className="text-xs text-[#8A94A6]">
              Unreturned loans where due_date &lt; evaluation date ({overdueLoans.length} active overdue records)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onNavigateToDesk}
              className="px-3 py-1.5 text-xs font-medium text-[#F4F6F8] bg-[#1C2129] hover:bg-[#262C36] border border-[#2D3440] rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Circulation Desk
            </button>
            <button
              type="button"
              onClick={() => downloadCsvReport('overdue')}
              className="px-3 py-1.5 text-xs font-medium text-[#F4F6F8] bg-[#1C2129] hover:bg-[#262C36] border border-[#2D3440] rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#D2FF00]" />
              Export Overdue CSV
            </button>
          </div>
        </div>

        {overdueLoans.length === 0 ? (
          <div className="p-8 text-center">
            <CheckCircle2 className="w-7 h-7 text-[#D2FF00] mx-auto mb-2" />
            <p className="text-sm font-medium text-[#F4F6F8]">Zero Overdue Loans</p>
            <p className="text-xs text-[#8A94A6] mt-1">
              All active library loans are within their due date window for {settings.reference_date}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222731] bg-[#0E1116] text-xs font-semibold text-[#8A94A6]">
                  <th className="py-2.5 px-4 whitespace-nowrap">Loan ID</th>
                  <th className="py-2.5 px-4">Book Title &amp; ISBN</th>
                  <th className="py-2.5 px-4">Borrower &amp; Roll No</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Issue Date</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Due Date</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Overdue Days</th>
                  <th className="py-2.5 px-4 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222731] text-sm">
                {overdueLoans.map((loan) => (
                  <tr key={loan.loan_id} className="hover:bg-[#191D24] transition-colors">
                    <td className="py-2.5 px-4 font-mono text-xs text-[#94A3B8] tabular-nums whitespace-nowrap">
                      #{loan.loan_id}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-[#F4F6F8]">{loan.book_title}</div>
                      <div className="text-xs text-[#8A94A6] font-mono">
                        {loan.isbn} · {loan.book_category}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-[#F4F6F8]">{loan.borrower_name}</div>
                      <div className="text-xs text-[#8A94A6] font-mono">{loan.roll_no}</div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs text-[#94A3B8] tabular-nums whitespace-nowrap">
                      {loan.issue_date}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs text-[#FF3B5C] font-medium tabular-nums whitespace-nowrap">
                      {loan.due_date}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs font-semibold text-[#FF3B5C] tabular-nums whitespace-nowrap">
                      OVERDUE · {loan.days_overdue}d
                    </td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onQuickReturnLoan(loan)}
                        className="px-2.5 py-1 text-xs font-bold text-[#0B0C0E] bg-[#D2FF00] hover:bg-[#b8e600] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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

      {/* Most-Borrowed Books Report (Expected Output #1) */}
      <section
        aria-label="Most-Borrowed Books Report"
        className="bg-[#13161B] border border-[#242933] rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#222731] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#F4F6F8]">
              Most-Borrowed Books Report
            </h2>
            <p className="text-xs text-[#8A94A6]">
              Complete circulation ranking across all catalog titles with live shelf availability
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadCsvReport('popular')}
            className="px-3 py-1.5 text-xs font-medium text-[#F4F6F8] bg-[#1C2129] hover:bg-[#262C36] border border-[#2D3440] rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-[#D2FF00]" />
            Export Popular Books CSV
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#222731] bg-[#0E1116] text-xs font-semibold text-[#8A94A6]">
                <th className="py-2.5 px-4 whitespace-nowrap">Rank</th>
                <th className="py-2.5 px-4">Title &amp; Author</th>
                <th className="py-2.5 px-4">Category &amp; ISBN</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Total Loans</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Active Out</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Overdue</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Copies Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222731] text-sm">
              {mostBorrowed.map((book) => (
                <tr key={book.book_id} className="hover:bg-[#191D24] transition-colors">
                  <td className="py-2.5 px-4 font-mono text-xs font-bold text-[#D2FF00] tabular-nums whitespace-nowrap">
                    #{book.rank}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-[#F4F6F8]">{book.title}</div>
                    <div className="text-xs text-[#8A94A6]">{book.author}</div>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-[#94A3B8]">
                    <span>{book.category}</span>
                    <span className="mx-1.5 text-[#475569]">·</span>
                    <span className="font-mono">{book.isbn}</span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-[#F4F6F8] tabular-nums whitespace-nowrap">
                    {book.total_loans}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-[#94A3B8] tabular-nums whitespace-nowrap">
                    {book.active_loans}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                    <span className={book.overdue_loans ? 'text-[#FF3B5C] font-semibold' : 'text-[#475569]'}>
                      {book.overdue_loans}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums whitespace-nowrap">
                    <span
                      className={
                        book.copies_available === 0
                          ? 'text-amber-400 font-semibold'
                          : 'text-[#D2FF00] font-medium'
                      }
                    >
                      {book.copies_available} {book.copies_available === 0 ? '(Out of stock)' : 'avail'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pandas Category Summary & NumPy Descriptive Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Summary (Expected Output #4) */}
        <section aria-label="Pandas Category Summary" className="bg-[#13161B] border border-[#242933] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#222731] flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[#F4F6F8]">
                Pandas Category Summary
              </h2>
              <p className="text-xs text-[#8A94A6]">
                Grouped aggregation by books.category with share distribution
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadCsvReport('category')}
              className="px-2.5 py-1 text-xs font-medium text-[#F4F6F8] bg-[#1C2129] hover:bg-[#262C36] border border-[#2D3440] rounded transition-colors cursor-pointer"
            >
              CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222731] bg-[#0E1116] text-xs font-semibold text-[#8A94A6]">
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-3 text-right">Titles</th>
                  <th className="py-2.5 px-3 text-right">Avail</th>
                  <th className="py-2.5 px-3 text-right">Loans</th>
                  <th className="py-2.5 px-3 text-right">Overdue</th>
                  <th className="py-2.5 px-4 text-right">Share</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222731] text-sm">
                {categorySummary.map((cat) => (
                  <tr key={cat.category} className="hover:bg-[#191D24]">
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-[#F4F6F8]">{cat.category}</div>
                      <div className="mt-1 w-28 h-1 bg-[#1E232B] rounded-full overflow-hidden">
                        <div
                          style={{
                            width: `${Math.min(100, cat.share_pct * 2.2)}%`,
                            transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                          }}
                          className="h-full bg-[#D2FF00] rounded-full"
                        />
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-[#94A3B8] tabular-nums">
                      {cat.total_titles}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-[#D2FF00] tabular-nums">
                      {cat.copies_available}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs font-semibold text-[#F4F6F8] tabular-nums">
                      {cat.total_loans}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-xs text-[#FF3B5C] tabular-nums">
                      {cat.overdue_loans}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs text-[#94A3B8] tabular-nums">
                      {cat.share_pct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* NumPy Descriptive Statistics Table */}
        <section aria-label="NumPy Descriptive Statistics" className="bg-[#13161B] border border-[#242933] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#222731]">
            <h2 className="text-base font-bold text-[#F4F6F8]">
              NumPy Descriptive Statistics
            </h2>
            <p className="text-xs text-[#8A94A6]">
              Statistical distribution across loan duration (days), issues per book, and overdue days
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222731] bg-[#0E1116] text-xs font-semibold text-[#8A94A6]">
                  <th className="py-2.5 px-4">Statistic (NumPy)</th>
                  <th className="py-2.5 px-4 text-right">Loan Duration (d)</th>
                  <th className="py-2.5 px-4 text-right">Loans / Book</th>
                  <th className="py-2.5 px-4 text-right">Overdue Days</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222731] text-sm font-mono tabular-nums">
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
                    <tr key={row.key} className="hover:bg-[#191D24]">
                      <td className="py-2 px-4 font-sans text-xs font-medium text-[#94A3B8]">
                        {row.label}
                      </td>
                      <td className="py-2 px-4 text-right text-xs text-[#F4F6F8]">
                        {row.key === 'range'
                          ? `${dStat.min ?? 0} – ${dStat.max ?? 0}`
                          : (dStat[row.key] ?? 0)}
                      </td>
                      <td className="py-2 px-4 text-right text-xs text-[#D2FF00]">
                        {row.key === 'range'
                          ? `${bStat.min ?? 0} – ${bStat.max ?? 0}`
                          : (bStat[row.key] ?? 0)}
                      </td>
                      <td className="py-2 px-4 text-right text-xs text-[#FF3B5C]">
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
};
