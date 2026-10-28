#!/usr/bin/env python3
"""
Project 5: Library Book Usage Analysis System
Standalone Pandas, NumPy & Matplotlib Data Analysis Script for Submission
=========================================================================
Run with:
    pip install pandas numpy matplotlib mysql-connector-python
    python3 library_analysis_pandas_numpy.py
"""

import sqlite3
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt


def load_dataframes(db_path: str = "../library_circulation.db"):
    """Loads books, borrowers, and loans tables into Pandas DataFrames."""
    conn = sqlite3.connect(db_path)
    books_df = pd.read_sql_query("SELECT * FROM books", conn)
    borrowers_df = pd.read_sql_query("SELECT * FROM borrowers", conn)
    loans_df = pd.read_sql_query("SELECT * FROM loans", conn)
    conn.close()
    return books_df, borrowers_df, loans_df


def analyze_circulation(books_df: pd.DataFrame, borrowers_df: pd.DataFrame, loans_df: pd.DataFrame, ref_date: str = "2026-10-28"):
    """Computes Pandas category/monthly summaries, overdue loans, and NumPy descriptive statistics."""
    ref_dt = pd.to_datetime(ref_date)
    loans = loans_df.copy()
    loans["issue_dt"] = pd.to_datetime(loans["issue_date"])
    loans["due_dt"] = pd.to_datetime(loans["due_date"])
    loans["return_dt"] = pd.to_datetime(loans["return_date"])

    # Calculate loan status and duration
    loans["is_returned"] = loans["return_dt"].notna()
    loans["is_overdue"] = (~loans["is_returned"]) & (loans["due_dt"] < ref_dt)
    loans["days_overdue"] = np.where(
        loans["is_overdue"],
        (ref_dt - loans["due_dt"]).dt.days,
        0,
    )
    loans["duration_days"] = np.where(
        loans["is_returned"],
        (loans["return_dt"] - loans["issue_dt"]).dt.days,
        (ref_dt - loans["issue_dt"]).dt.days,
    )

    # Merge full circulation master table
    merged = loans.merge(books_df, on="book_id", how="left").merge(borrowers_df, on="borrower_id", how="left")

    # 1. Most-Borrowed Books Report (Pandas groupby)
    popular_books = (
        merged.groupby(["book_id", "isbn", "title", "author", "category", "copies_available"], as_index=False)
        .agg(
            total_loans=("loan_id", "count"),
            active_loans=("is_returned", lambda s: int((~s).sum())),
            overdue_loans=("is_overdue", "sum"),
        )
        .sort_values(by=["total_loans", "active_loans"], ascending=[False, False])
    )

    # 2. Category Summary (Pandas groupby)
    category_summary = (
        merged.groupby("category", as_index=False)
        .agg(
            total_loans=("loan_id", "count"),
            active_loans=("is_returned", lambda s: int((~s).sum())),
            overdue_loans=("is_overdue", "sum"),
        )
        .sort_values(by="total_loans", ascending=False)
    )
    category_summary["share_pct"] = np.round(
        category_summary["total_loans"] / len(loans) * 100.0, 2
    )

    # 3. Monthly Borrowing Trends (Pandas period formatting)
    merged["issue_month"] = merged["issue_dt"].dt.strftime("%Y-%m")
    monthly_summary = (
        merged.groupby("issue_month", as_index=False)
        .agg(
            total_issued=("loan_id", "count"),
            returned_count=("is_returned", "sum"),
            overdue_count=("is_overdue", "sum"),
            unique_borrowers=("borrower_id", "nunique"),
        )
        .sort_values(by="issue_month")
    )

    # 4. Overdue Loans List
    overdue_df = merged[merged["is_overdue"]].sort_values(by="days_overdue", ascending=False)[
        ["loan_id", "title", "borrower_name", "roll_no", "issue_date", "due_date", "days_overdue"]
    ]

    # 5. NumPy Descriptive Statistics
    durations = loans["duration_days"].to_numpy(dtype=float)
    numpy_summary = {
        "mean_duration": float(np.mean(durations)),
        "median_duration": float(np.median(durations)),
        "std_duration": float(np.std(durations)),
        "var_duration": float(np.var(durations)),
        "p25_duration": float(np.percentile(durations, 25)),
        "p75_duration": float(np.percentile(durations, 75)),
    }

    return popular_books, category_summary, monthly_summary, overdue_df, numpy_summary


def plot_matplotlib_charts(popular_books: pd.DataFrame, monthly_summary: pd.DataFrame, output_path: str = "library_usage_charts.png"):
    """Generates Matplotlib multi-panel figure for Monthly Borrowing Trends & Popular Books."""
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5.5))

    # Left subplot: Monthly Borrowing Trends
    ax1.plot(
        monthly_summary["issue_month"],
        monthly_summary["total_issued"],
        marker="o",
        linewidth=2.2,
        color="#0F172A",
        label="Total Issued",
    )
    ax1.bar(
        monthly_summary["issue_month"],
        monthly_summary["returned_count"],
        alpha=0.65,
        color="#0284C7",
        label="Returned",
    )
    ax1.set_title("Monthly Library Borrowing Trends", fontsize=12, fontweight="bold")
    ax1.set_xlabel("Month (YYYY-MM)")
    ax1.set_ylabel("Number of Loans")
    ax1.grid(axis="y", linestyle="--", alpha=0.5)
    ax1.legend()

    # Right subplot: Most-Borrowed Books
    top_n = popular_books.head(6).iloc[::-1]
    ax2.barh(top_n["title"].str.slice(0, 28), top_n["total_loans"], color="#0F172A")
    ax2.set_title("Most-Borrowed Books Ranking", fontsize=12, fontweight="bold")
    ax2.set_xlabel("Total Borrowing Transactions")
    ax2.grid(axis="x", linestyle="--", alpha=0.5)

    plt.tight_layout()
    plt.savefig(output_path, dpi=150)
    plt.close(fig)


if __name__ == "__main__":
    books, borrowers, loans = load_dataframes()
    pop, cat, mon, over, stats = analyze_circulation(books, borrowers, loans)
    print("=== MOST-BORROWED BOOKS ===")
    print(pop.to_string(index=False))
    print("\n=== CATEGORY SUMMARY ===")
    print(cat.to_string(index=False))
    print("\n=== MONTHLY TRENDS ===")
    print(mon.to_string(index=False))
    print("\n=== OVERDUE LOANS ===")
    print(over.to_string(index=False))
    print("\n=== NUMPY DESCRIPTIVE STATS ===")
    for k, v in stats.items():
        print(f"  {k}: {v:.2f}")
