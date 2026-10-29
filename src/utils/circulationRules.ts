export interface BookRecord {
  book_id: number;
  isbn: string;
  title: string;
  author: string;
  category: string;
  copies_available: number;
  total_loans?: number;
  active_loans?: number;
  overdue_loans?: number;
  returned_loans?: number;
  total_inventory?: number;
  utilization_pct?: number;
  rank?: number;
}

export interface BorrowerRecord {
  borrower_id: number;
  borrower_name: string;
  roll_no: string;
  total_borrowed?: number;
  active_loans?: number;
  overdue_loans?: number;
}

export interface LoanRecord {
  loan_id: number;
  book_id: number;
  isbn?: string;
  book_title?: string;
  book_author?: string;
  book_category?: string;
  borrower_id: number;
  borrower_name?: string;
  roll_no?: string;
  issue_date: string;
  due_date: string;
  return_date: string | null;
  status?: 'ACTIVE' | 'OVERDUE' | 'RETURNED';
  is_overdue?: boolean;
  days_overdue?: number;
  duration_days?: number;
  days_until_due?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface Point2D {
  x: number;
  y: number;
}

export interface DonutSegment {
  category: string;
  totalLoans: number;
  sharePct: number;
  color: string;
  dashArray: string;
  dashOffset: number;
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidIsoDate(dateStr: string): boolean {
  if (!dateStr || !ISO_DATE_REGEX.test(dateStr.trim())) {
    return false;
  }
  const d = new Date(`${dateStr.trim()}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return false;
  return d.toISOString().slice(0, 10) === dateStr.trim();
}

export function calculateConfigurableDueDate(issueDateStr: string, dueDays: number): string {
  if (!isValidIsoDate(issueDateStr)) {
    throw new Error(`Invalid issue_date: ${issueDateStr}`);
  }
  if (!Number.isInteger(dueDays) || dueDays < 1 || dueDays > 365) {
    throw new Error('Configurable due days must be an integer between 1 and 365.');
  }
  const d = new Date(`${issueDateStr.trim()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dueDays);
  return d.toISOString().slice(0, 10);
}

export function diffDaysIso(startIso: string, endIso: string): number {
  const s = new Date(`${startIso.trim()}T00:00:00Z`).getTime();
  const e = new Date(`${endIso.trim()}T00:00:00Z`).getTime();
  return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

export function calculateOverdueState(
  loan: Pick<LoanRecord, 'issue_date' | 'due_date' | 'return_date'>,
  referenceDateStr: string
): {
  status: 'ACTIVE' | 'OVERDUE' | 'RETURNED';
  isOverdue: boolean;
  daysOverdue: number;
  durationDays: number;
} {
  if (loan.return_date) {
    const durationDays = Math.max(0, diffDaysIso(loan.issue_date, loan.return_date));
    const lateDays = Math.max(0, diffDaysIso(loan.due_date, loan.return_date));
    return {
      status: 'RETURNED',
      isOverdue: false,
      daysOverdue: lateDays,
      durationDays,
    };
  }

  const durationDays = Math.max(0, diffDaysIso(loan.issue_date, referenceDateStr));
  const overdueDelta = diffDaysIso(loan.due_date, referenceDateStr);
  if (overdueDelta > 0) {
    return {
      status: 'OVERDUE',
      isOverdue: true,
      daysOverdue: overdueDelta,
      durationDays,
    };
  }

  return {
    status: 'ACTIVE',
    isOverdue: false,
    daysOverdue: 0,
    durationDays,
  };
}

export function validateIssueTransaction(params: {
  book: BookRecord | undefined;
  borrower: BorrowerRecord | undefined;
  issueDate: string;
  dueDate: string;
}): ValidationResult {
  const { book, borrower, issueDate, dueDate } = params;
  if (!book) {
    return { valid: false, error: 'Please select a valid book from the catalog.' };
  }
  if (!borrower) {
    return { valid: false, error: 'Please select a registered borrower.' };
  }
  if (book.copies_available <= 0) {
    return {
      valid: false,
      error: `Cannot issue "${book.title}": 0 copies available in inventory.`,
    };
  }
  if (!isValidIsoDate(issueDate)) {
    return { valid: false, error: 'Issue date must be a valid YYYY-MM-DD date.' };
  }
  if (!isValidIsoDate(dueDate)) {
    return { valid: false, error: 'Due date must be a valid YYYY-MM-DD date.' };
  }
  if (diffDaysIso(issueDate, dueDate) < 0) {
    return {
      valid: false,
      error: 'Invalid issue/due sequence: Due date cannot be earlier than issue date.',
    };
  }
  return { valid: true };
}

export function validateReturnTransaction(params: {
  loan: LoanRecord | undefined;
  returnDate: string;
}): ValidationResult {
  const { loan, returnDate } = params;
  if (!loan) {
    return { valid: false, error: 'Loan record not found.' };
  }
  if (loan.return_date !== null) {
    return {
      valid: false,
      error: `Invalid return sequence: Loan #${loan.loan_id} was already returned on ${loan.return_date}.`,
    };
  }
  if (!isValidIsoDate(returnDate)) {
    return { valid: false, error: 'Return date must be a valid YYYY-MM-DD date.' };
  }
  if (diffDaysIso(loan.issue_date, returnDate) < 0) {
    return {
      valid: false,
      error: `Invalid issue/return sequence: Return date (${returnDate}) cannot be earlier than issue date (${loan.issue_date}).`,
    };
  }
  return { valid: true };
}

export function applyIssueLocally(
  books: BookRecord[],
  loans: LoanRecord[],
  newLoan: LoanRecord
): { books: BookRecord[]; loans: LoanRecord[] } {
  const check = validateIssueTransaction({
    book: books.find((b) => b.book_id === newLoan.book_id),
    borrower: { borrower_id: newLoan.borrower_id, borrower_name: 'Test', roll_no: 'R1' },
    issueDate: newLoan.issue_date,
    dueDate: newLoan.due_date,
  });
  if (!check.valid) {
    throw new Error(check.error);
  }

  const updatedBooks = books.map((b) =>
    b.book_id === newLoan.book_id
      ? { ...b, copies_available: b.copies_available - 1 }
      : b
  );
  return {
    books: updatedBooks,
    loans: [newLoan, ...loans],
  };
}

export function applyReturnLocally(
  books: BookRecord[],
  loans: LoanRecord[],
  loanId: number,
  returnDate: string
): { books: BookRecord[]; loans: LoanRecord[] } {
  const targetLoan = loans.find((l) => l.loan_id === loanId);
  const check = validateReturnTransaction({ loan: targetLoan, returnDate });
  if (!check.valid || !targetLoan) {
    throw new Error(check.error);
  }

  const updatedLoans = loans.map((l) =>
    l.loan_id === loanId
      ? { ...l, return_date: returnDate, status: 'RETURNED' as const, is_overdue: false }
      : l
  );
  const updatedBooks = books.map((b) =>
    b.book_id === targetLoan.book_id
      ? { ...b, copies_available: b.copies_available + 1 }
      : b
  );

  return {
    books: updatedBooks,
    loans: updatedLoans,
  };
}

/**
 * Generates a smooth cubic Bezier spline path and closed area path from 2D chart coordinates.
 */
export function buildSmoothSplinePaths(
  points: Point2D[],
  baselineY = 190
): { linePath: string; areaPath: string } {
  if (!points || points.length === 0) {
    return { linePath: '', areaPath: '' };
  }
  if (points.length === 1) {
    const p = points[0];
    return {
      linePath: `M ${p.x.toFixed(1)},${p.y.toFixed(1)}`,
      areaPath: `M ${p.x.toFixed(1)},${p.y.toFixed(1)} L ${p.x.toFixed(1)},${baselineY} Z`,
    };
  }

  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const midX = (curr.x + next.x) / 2;
    d += ` C ${midX.toFixed(1)},${curr.y.toFixed(1)} ${midX.toFixed(1)},${next.y.toFixed(1)} ${next.x.toFixed(1)},${next.y.toFixed(1)}`;
  }

  const first = points[0];
  const last = points[points.length - 1];
  const areaPath = `${d} L ${last.x.toFixed(1)},${baselineY} L ${first.x.toFixed(1)},${baselineY} Z`;

  return { linePath: d, areaPath };
}

/**
 * Computes SVG stroke-dasharray and stroke-dashoffset segments for a radial donut chart
 * from real category circulation summary data.
 */
export function computeDonutSegments(
  categories: { category: string; total_loans: number; share_pct: number }[],
  radius = 48
): DonutSegment[] {
  const circumference = 2 * Math.PI * radius;
  const palette = ['#34d399', '#38bdf8', '#ffd085', '#f43f5e', '#a78bfa', '#fb923c'];
  const total = categories.reduce((acc, c) => acc + Math.max(0, c.total_loans || 0), 0) || 1;

  let cumulativeLength = 0;
  return categories.map((cat, idx) => {
    const fraction = Math.max(0, cat.total_loans || 0) / total;
    const segLen = Math.max(0, fraction * circumference);
    const gapAdjusted = Math.max(2, segLen - 4);
    const segment: DonutSegment = {
      category: cat.category,
      totalLoans: cat.total_loans || 0,
      sharePct: cat.share_pct ?? Number((fraction * 100).toFixed(1)),
      color: palette[idx % palette.length],
      dashArray: `${gapAdjusted.toFixed(1)} ${circumference.toFixed(1)}`,
      dashOffset: Number((-cumulativeLength).toFixed(1)),
    };
    cumulativeLength += segLen;
    return segment;
  });
}
