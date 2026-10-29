import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateConfigurableDueDate,
  calculateOverdueState,
  validateIssueTransaction,
  validateReturnTransaction,
  applyIssueLocally,
  applyReturnLocally,
  buildSmoothSplinePaths,
  computeDonutSegments,
  type BookRecord,
  type BorrowerRecord,
  type LoanRecord,
} from './circulationRules';

const sampleBook: BookRecord = {
  book_id: 1,
  isbn: '978-1491957660',
  title: 'Python for Data Analysis',
  author: 'Wes McKinney',
  category: 'Data Science',
  copies_available: 2,
};

const exhaustedBook: BookRecord = {
  ...sampleBook,
  book_id: 2,
  copies_available: 0,
};

const sampleBorrower: BorrowerRecord = {
  borrower_id: 1,
  borrower_name: 'Aarav Sharma',
  roll_no: 'CS2024-014',
};

test('calculateConfigurableDueDate computes accurate due date for configurable window', () => {
  assert.equal(calculateConfigurableDueDate('2026-10-01', 14), '2026-10-15');
  assert.equal(calculateConfigurableDueDate('2026-10-25', 10), '2026-11-04');
});

test('calculateOverdueState identifies ACTIVE, OVERDUE, and RETURNED loans accurately', () => {
  const overdueCheck = calculateOverdueState(
    { issue_date: '2026-09-10', due_date: '2026-09-24', return_date: null },
    '2026-10-28'
  );
  assert.equal(overdueCheck.status, 'OVERDUE');
  assert.equal(overdueCheck.isOverdue, true);
  assert.equal(overdueCheck.daysOverdue, 34);

  const activeCheck = calculateOverdueState(
    { issue_date: '2026-10-20', due_date: '2026-11-03', return_date: null },
    '2026-10-28'
  );
  assert.equal(activeCheck.status, 'ACTIVE');
  assert.equal(activeCheck.isOverdue, false);
  assert.equal(activeCheck.daysOverdue, 0);

  const returnedCheck = calculateOverdueState(
    { issue_date: '2026-10-01', due_date: '2026-10-15', return_date: '2026-10-12' },
    '2026-10-28'
  );
  assert.equal(returnedCheck.status, 'RETURNED');
  assert.equal(returnedCheck.isOverdue, false);
  assert.equal(returnedCheck.durationDays, 11);
});

test('validateIssueTransaction rejects zero copies_available and invalid issue/due date sequences', () => {
  const zeroCopiesRes = validateIssueTransaction({
    book: exhaustedBook,
    borrower: sampleBorrower,
    issueDate: '2026-10-10',
    dueDate: '2026-10-24',
  });
  assert.equal(zeroCopiesRes.valid, false);
  assert.match(zeroCopiesRes.error || '', /0 copies available/);

  const badDueSequence = validateIssueTransaction({
    book: sampleBook,
    borrower: sampleBorrower,
    issueDate: '2026-10-20',
    dueDate: '2026-10-15',
  });
  assert.equal(badDueSequence.valid, false);
  assert.match(badDueSequence.error || '', /Due date cannot be earlier than issue date/);

  const validRes = validateIssueTransaction({
    book: sampleBook,
    borrower: sampleBorrower,
    issueDate: '2026-10-10',
    dueDate: '2026-10-24',
  });
  assert.equal(validRes.valid, true);
});

test('validateReturnTransaction rejects return_date before issue_date and double returns', () => {
  const activeLoan: LoanRecord = {
    loan_id: 101,
    book_id: 1,
    borrower_id: 1,
    issue_date: '2026-10-10',
    due_date: '2026-10-24',
    return_date: null,
  };

  // Reject return_date < issue_date
  const beforeIssue = validateReturnTransaction({
    loan: activeLoan,
    returnDate: '2026-10-08',
  });
  assert.equal(beforeIssue.valid, false);
  assert.match(beforeIssue.error || '', /cannot be earlier than issue date/);

  // Accept valid return
  const validReturn = validateReturnTransaction({
    loan: activeLoan,
    returnDate: '2026-10-18',
  });
  assert.equal(validReturn.valid, true);

  // Reject returning an already returned loan
  const returnedLoan: LoanRecord = {
    ...activeLoan,
    return_date: '2026-10-18',
  };
  const doubleReturn = validateReturnTransaction({
    loan: returnedLoan,
    returnDate: '2026-10-20',
  });
  assert.equal(doubleReturn.valid, false);
  assert.match(doubleReturn.error || '', /already returned/);
});

test('available-copy counts remain consistent across issue and return lifecycle', () => {
  const initialBooks: BookRecord[] = [{ ...sampleBook, copies_available: 2 }];
  const initialLoans: LoanRecord[] = [];

  const issuedLoan: LoanRecord = {
    loan_id: 500,
    book_id: 1,
    borrower_id: 1,
    issue_date: '2026-10-10',
    due_date: '2026-10-24',
    return_date: null,
    status: 'ACTIVE',
  };

  const afterIssue = applyIssueLocally(initialBooks, initialLoans, issuedLoan);
  assert.equal(afterIssue.books[0].copies_available, 1);
  assert.equal(afterIssue.loans.length, 1);

  const afterReturn = applyReturnLocally(
    afterIssue.books,
    afterIssue.loans,
    500,
    '2026-10-22'
  );
  assert.equal(afterReturn.books[0].copies_available, 2);
  assert.equal(afterReturn.loans[0].status, 'RETURNED');
  assert.equal(afterReturn.loans[0].return_date, '2026-10-22');
});

test('buildSmoothSplinePaths and computeDonutSegments generate valid SVG paths and segments', () => {
  const spline = buildSmoothSplinePaths(
    [
      { x: 40, y: 150 },
      { x: 200, y: 90 },
      { x: 400, y: 60 },
    ],
    190
  );
  assert.ok(spline.linePath.startsWith('M 40.0,150.0 C'));
  assert.ok(spline.areaPath.endsWith('Z'));

  const segments = computeDonutSegments([
    { category: 'Data Science', total_loans: 10, share_pct: 50 },
    { category: 'Algorithms', total_loans: 10, share_pct: 50 },
  ]);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].dashOffset, 0);
  assert.ok(segments[1].dashOffset < 0);
});
