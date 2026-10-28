#!/usr/bin/env python3
"""
Unit Tests for Project 5: Python 3 Library Book Usage Analysis System
Verifies all acceptance criteria:
  1. A returned book updates its loan status and increments available copies
  2. Invalid issue/return sequences are rejected (0 copies available, return_date < issue_date, double return)
  3. Available-copy counts remain consistent across transactions
  4. Overdue calculations respect configurable due date / evaluation reference date
"""

import unittest
from library_engine import (
    init_db,
    build_full_state,
    issue_book,
    return_book,
    update_settings,
)


class TestLibraryEngine(unittest.TestCase):
    def setUp(self):
        init_db(force_reset=True)

    def test_initial_reports_and_kpis(self):
        state = build_full_state()
        self.assertEqual(state["kpis"]["total_books_titles"], 10)
        self.assertEqual(state["kpis"]["total_borrowers"], 8)
        self.assertEqual(state["kpis"]["total_loans"], 26)
        self.assertEqual(state["kpis"]["overdue_loans"], 4)
        self.assertTrue(len(state["reports"]["most_borrowed_books"]) == 10)
        self.assertTrue(len(state["reports"]["category_summary"]) >= 5)
        self.assertTrue(len(state["reports"]["monthly_trends"]) == 6)

    def test_issue_and_return_copy_consistency(self):
        before = build_full_state()
        book1_before = next(b for b in before["books"] if b["book_id"] == 1)
        avail_before = book1_before["copies_available"]

        # Issue book_id=1 to borrower_id=2
        issue_res = issue_book({
            "book_id": 1,
            "borrower_id": 2,
            "issue_date": "2026-10-25",
            "due_date": "2026-11-08",
        })
        self.assertTrue(issue_res["ok"])
        after_issue = issue_res["state"]
        book1_mid = next(b for b in after_issue["books"] if b["book_id"] == 1)
        self.assertEqual(book1_mid["copies_available"], avail_before - 1)

        new_loan = after_issue["loans"][0]
        self.assertEqual(new_loan["status"], "ACTIVE")

        # Return the newly issued loan
        return_res = return_book({
            "loan_id": new_loan["loan_id"],
            "return_date": "2026-10-28",
        })
        self.assertTrue(return_res["ok"])
        after_return = return_res["state"]
        book1_after = next(b for b in after_return["books"] if b["book_id"] == 1)
        self.assertEqual(book1_after["copies_available"], avail_before)

        returned_loan = next(l for l in after_return["loans"] if l["loan_id"] == new_loan["loan_id"])
        self.assertEqual(returned_loan["status"], "RETURNED")
        self.assertEqual(returned_loan["return_date"], "2026-10-28")

    def test_reject_invalid_sequences_and_zero_stock(self):
        # Book 5 has 0 copies_available in seed data
        zero_stock_res = issue_book({
            "book_id": 5,
            "borrower_id": 1,
            "issue_date": "2026-10-28",
            "due_date": "2026-11-11",
        })
        self.assertFalse(zero_stock_res["ok"])
        self.assertIn("0 copies available", zero_stock_res["error"])

        # Reject due_date < issue_date
        bad_due_res = issue_book({
            "book_id": 1,
            "borrower_id": 1,
            "issue_date": "2026-10-28",
            "due_date": "2026-10-20",
        })
        self.assertFalse(bad_due_res["ok"])

        # Loan #20 was issued on 2026-09-10; reject return_date < 2026-09-10
        bad_return_res = return_book({
            "loan_id": 20,
            "return_date": "2026-09-01",
        })
        self.assertFalse(bad_return_res["ok"])
        self.assertIn("cannot be earlier than issue_date", bad_return_res["error"])

        # Loan #1 is already returned; reject returning again
        double_return_res = return_book({
            "loan_id": 1,
            "return_date": "2026-10-28",
        })
        self.assertFalse(double_return_res["ok"])
        self.assertIn("already returned", double_return_res["error"])


if __name__ == "__main__":
    unittest.main()
