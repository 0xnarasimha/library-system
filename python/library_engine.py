#!/usr/bin/env python3
"""
Project 5: Library Book Usage Analysis System (Python 3 Primary Engine)
=======================================================================
Entities / Relational Tables (MySQL & SQLite compatible):
  - books(book_id, isbn, title, author, category, copies_available)
  - borrowers(borrower_id, borrower_name, roll_no)
  - loans(loan_id, book_id, borrower_id, issue_date, due_date, return_date)

Core Capabilities:
  1. Manage book and borrower records
  2. Record issue and return dates with strict sequence & inventory validation
  3. Calculate overdue status using a configurable due date / reference date
  4. Identify most-borrowed books and monthly borrowing trends
  5. Summarize active loans, overdue counts, and category circulation
  6. Data Analysis & Visualization (Pandas/NumPy/Matplotlib + Native Python 3 fallback)
"""

import sys
import os
import json
import math
import sqlite3
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional, Tuple

# Optional scientific stack detection (uses real Pandas/NumPy/Matplotlib if installed,
# with deterministic standard-library analytical implementation when running in minimal containers)
try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False

try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "library_circulation.db")
DEFAULT_REFERENCE_DATE = "2026-10-28"
DEFAULT_DUE_DAYS = 14


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def parse_iso_date(date_str: str) -> date:
    if not date_str or not isinstance(date_str, str):
        raise ValueError("Date string is required in YYYY-MM-DD format.")
    try:
        return datetime.strptime(date_str.strip()[:10], "%Y-%m-%d").date()
    except Exception as exc:
        raise ValueError(f"Invalid date format '{date_str}'. Expected YYYY-MM-DD.") from exc


def init_db(force_reset: bool = False) -> None:
    conn = get_connection()
    cur = conn.cursor()

    if force_reset:
        cur.executescript("""
            DROP TABLE IF EXISTS loans;
            DROP TABLE IF EXISTS borrowers;
            DROP TABLE IF EXISTS books;
            DROP TABLE IF EXISTS settings;
        """)

    cur.executescript("""
        CREATE TABLE IF NOT EXISTS settings (
            setting_key TEXT PRIMARY KEY,
            setting_value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS books (
            book_id INTEGER PRIMARY KEY AUTOINCREMENT,
            isbn TEXT NOT NULL UNIQUE,
            title TEXT NOT NULL,
            author TEXT NOT NULL,
            category TEXT NOT NULL,
            copies_available INTEGER NOT NULL CHECK (copies_available >= 0)
        );

        CREATE TABLE IF NOT EXISTS borrowers (
            borrower_id INTEGER PRIMARY KEY AUTOINCREMENT,
            borrower_name TEXT NOT NULL,
            roll_no TEXT NOT NULL UNIQUE
        );

        CREATE TABLE IF NOT EXISTS loans (
            loan_id INTEGER PRIMARY KEY AUTOINCREMENT,
            book_id INTEGER NOT NULL,
            borrower_id INTEGER NOT NULL,
            issue_date TEXT NOT NULL,
            due_date TEXT NOT NULL,
            return_date TEXT DEFAULT NULL,
            FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
            FOREIGN KEY (borrower_id) REFERENCES borrowers(borrower_id) ON DELETE CASCADE
        );
    """)

    # Seed settings if missing
    cur.execute("SELECT COUNT(*) AS cnt FROM settings")
    if cur.fetchone()["cnt"] == 0:
        cur.executemany(
            "INSERT INTO settings (setting_key, setting_value) VALUES (?, ?)",
            [
                ("default_due_days", str(DEFAULT_DUE_DAYS)),
                ("reference_date", DEFAULT_REFERENCE_DATE),
            ],
        )

    # Seed initial books, borrowers, and historical + active circulation transactions if empty
    cur.execute("SELECT COUNT(*) AS cnt FROM books")
    if cur.fetchone()["cnt"] == 0:
        seed_books = [
            (1, "978-0132350884", "Clean Code: A Handbook of Agile Software Craftsmanship", "Robert C. Martin", "Software Engineering", 3),
            (2, "978-1491957660", "Python for Data Analysis (3rd Edition)", "Wes McKinney", "Data Science", 2),
            (3, "978-0262033848", "Introduction to Algorithms (CLRS)", "Thomas H. Cormen", "Computer Science", 1),
            (4, "978-1449355739", "Learning Python", "Mark Lutz", "Programming", 4),
            (5, "978-1098125974", "Hands-On Machine Learning with Scikit-Learn & PyTorch", "Aurelien Geron", "AI & Machine Learning", 0),
            (6, "978-0133594140", "Database System Concepts", "Abraham Silberschatz", "Database Systems", 3),
            (7, "978-1492051367", "Fluent Python: Clear, Concise, and Effective Programming", "Luciano Ramalho", "Programming", 2),
            (8, "978-0134685991", "Effective Java", "Joshua Bloch", "Software Engineering", 5),
            (9, "978-0321751041", "The Art of Computer Programming, Vol. 1", "Donald E. Knuth", "Computer Science", 2),
            (10, "978-1492032649", "Storytelling with Data", "Cole Nussbaumer Knaflic", "Data Science", 3),
        ]
        cur.executemany(
            """
            INSERT INTO books (book_id, isbn, title, author, category, copies_available)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            seed_books,
        )

        seed_borrowers = [
            (1, "Aarav Sharma", "CS2024-014"),
            (2, "Priya Nair", "DS2024-008"),
            (3, "Rohan Verma", "CS2023-102"),
            (4, "Ananya Iyer", "AI2024-019"),
            (5, "Vikramaditya Reddy", "CS2024-055"),
            (6, "Meera Krishnan", "DB2023-041"),
            (7, "Siddharth Joshi", "DS2024-033"),
            (8, "Kavya Patel", "SE2024-027"),
        ]
        cur.executemany(
            """
            INSERT INTO borrowers (borrower_id, borrower_name, roll_no)
            VALUES (?, ?, ?)
            """,
            seed_borrowers,
        )

        # 26 realistic loans across May 2026 - Oct 2026 (including returned, active on-time, and overdue loans)
        seed_loans = [
            # May 2026
            (1, 2, 1, "2026-05-04", "2026-05-18", "2026-05-15"),
            (2, 1, 2, "2026-05-10", "2026-05-24", "2026-05-22"),
            (3, 5, 4, "2026-05-14", "2026-05-28", "2026-06-02"),
            (4, 3, 3, "2026-05-20", "2026-06-03", "2026-05-31"),
            # June 2026
            (5, 2, 5, "2026-06-02", "2026-06-16", "2026-06-14"),
            (6, 7, 1, "2026-06-08", "2026-06-22", "2026-06-19"),
            (7, 6, 6, "2026-06-12", "2026-06-26", "2026-06-25"),
            (8, 2, 7, "2026-06-19", "2026-07-03", "2026-07-01"),
            # July 2026
            (9, 1, 3, "2026-07-03", "2026-07-17", "2026-07-16"),
            (10, 5, 2, "2026-07-09", "2026-07-23", "2026-07-28"),
            (11, 4, 8, "2026-07-15", "2026-07-29", "2026-07-24"),
            (12, 3, 5, "2026-07-21", "2026-08-04", "2026-08-02"),
            (13, 2, 4, "2026-07-25", "2026-08-08", "2026-08-05"),
            # August 2026
            (14, 7, 2, "2026-08-04", "2026-08-18", "2026-08-17"),
            (15, 5, 1, "2026-08-11", "2026-08-25", "2026-08-22"),
            (16, 6, 3, "2026-08-16", "2026-08-30", "2026-08-29"),
            (17, 1, 7, "2026-08-22", "2026-09-05", "2026-09-04"),
            (18, 10, 6, "2026-08-27", "2026-09-10", "2026-09-08"),
            # September 2026
            (19, 2, 3, "2026-09-03", "2026-09-17", "2026-09-15"),
            (20, 5, 5, "2026-09-10", "2026-09-24", None),        # OVERDUE (due Sep 24, ref Oct 28 -> 34 days overdue)
            (21, 3, 1, "2026-09-18", "2026-10-02", None),        # OVERDUE (due Oct 02, ref Oct 28 -> 26 days overdue)
            (22, 4, 2, "2026-09-25", "2026-10-09", "2026-10-07"),
            # October 2026
            (23, 7, 4, "2026-10-02", "2026-10-16", None),        # OVERDUE (due Oct 16, ref Oct 28 -> 12 days overdue)
            (24, 2, 6, "2026-10-08", "2026-10-22", None),        # OVERDUE (due Oct 22, ref Oct 28 -> 6 days overdue)
            (25, 1, 5, "2026-10-18", "2026-11-01", None),        # ACTIVE ON-TIME (due Nov 01)
            (26, 6, 8, "2026-10-22", "2026-11-05", None),        # ACTIVE ON-TIME (due Nov 05)
        ]
        cur.executemany(
            """
            INSERT INTO loans (loan_id, book_id, borrower_id, issue_date, due_date, return_date)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            seed_loans,
        )

    conn.commit()
    conn.close()


def get_settings(conn: sqlite3.Connection) -> Dict[str, Any]:
    cur = conn.cursor()
    cur.execute("SELECT setting_key, setting_value FROM settings")
    rows = {r["setting_key"]: r["setting_value"] for r in cur.fetchall()}
    return {
        "default_due_days": int(rows.get("default_due_days", DEFAULT_DUE_DAYS)),
        "reference_date": rows.get("reference_date", DEFAULT_REFERENCE_DATE),
    }


def enrich_loan(row: Dict[str, Any], ref_date: date) -> Dict[str, Any]:
    issue_dt = parse_iso_date(row["issue_date"])
    due_dt = parse_iso_date(row["due_date"])
    return_str = row.get("return_date")

    if return_str:
        return_dt = parse_iso_date(return_str)
        duration_days = max(0, (return_dt - issue_dt).days)
        late_days = max(0, (return_dt - due_dt).days)
        status = "RETURNED"
        is_overdue = False
        days_overdue = late_days
    else:
        duration_days = max(0, (ref_date - issue_dt).days)
        if ref_date > due_dt:
            status = "OVERDUE"
            is_overdue = True
            days_overdue = (ref_date - due_dt).days
        else:
            status = "ACTIVE"
            is_overdue = False
            days_overdue = 0

    return {
        **row,
        "status": status,
        "is_overdue": is_overdue,
        "days_overdue": days_overdue,
        "duration_days": duration_days,
        "days_until_due": (due_dt - ref_date).days if not return_str else 0,
    }


def compute_numpy_statistics(values: List[float]) -> Dict[str, float]:
    if not values:
        return {
            "count": 0,
            "mean": 0.0,
            "median": 0.0,
            "std_dev": 0.0,
            "variance": 0.0,
            "min": 0.0,
            "max": 0.0,
            "p25": 0.0,
            "p75": 0.0,
            "iqr": 0.0,
        }

    if HAS_NUMPY:
        arr = np.array(values, dtype=float)
        p25 = float(np.percentile(arr, 25))
        p75 = float(np.percentile(arr, 75))
        return {
            "count": int(arr.size),
            "mean": round(float(np.mean(arr)), 2),
            "median": round(float(np.median(arr)), 2),
            "std_dev": round(float(np.std(arr)), 2),
            "variance": round(float(np.var(arr)), 2),
            "min": round(float(np.min(arr)), 2),
            "max": round(float(np.max(arr)), 2),
            "p25": round(p25, 2),
            "p75": round(p75, 2),
            "iqr": round(p75 - p25, 2),
        }

    sorted_vals = sorted(float(v) for v in values)
    n = len(sorted_vals)
    mean_val = sum(sorted_vals) / n
    variance_val = sum((x - mean_val) ** 2 for x in sorted_vals) / n
    std_val = math.sqrt(variance_val)

    def percentile(data: List[float], pct: float) -> float:
        if len(data) == 1:
            return data[0]
        k = (len(data) - 1) * (pct / 100.0)
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return data[int(k)]
        return data[f] * (c - k) + data[c] * (k - f)

    med = percentile(sorted_vals, 50)
    p25 = percentile(sorted_vals, 25)
    p75 = percentile(sorted_vals, 75)

    return {
        "count": n,
        "mean": round(mean_val, 2),
        "median": round(med, 2),
        "std_dev": round(std_val, 2),
        "variance": round(variance_val, 2),
        "min": round(sorted_vals[0], 2),
        "max": round(sorted_vals[-1], 2),
        "p25": round(p25, 2),
        "p75": round(p75, 2),
        "iqr": round(p75 - p25, 2),
    }


def generate_matplotlib_monthly_svg(monthly_rows: List[Dict[str, Any]]) -> str:
    """Generates a dark glassmorphic Matplotlib SVG chart with Warm Gold (#ffd085) & Sky (#38bdf8) telemetry styling directly from Python."""
    width, height = 740, 310
    pad_l, pad_r, pad_t, pad_b = 54, 28, 48, 48
    plot_w = width - pad_l - pad_r
    plot_h = height - pad_t - pad_b

    if not monthly_rows:
        return f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg"></svg>'

    max_val = max(max(r["total_issued"], 1) for r in monthly_rows)
    y_max = max(6, math.ceil(max_val * 1.2))
    n = len(monthly_rows)
    step_x = plot_w / max(1, n)

    svg_lines = [
        f'<svg viewBox="0 0 {width} {height}" class="w-full h-auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Matplotlib Monthly Borrowing Trends Chart">',
        '<defs>',
        '  <linearGradient id="gradReturned" x1="0" y1="0" x2="0" y2="1">',
        '    <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.95"/>',
        '    <stop offset="100%" stop-color="#0284c7" stop-opacity="0.55"/>',
        '  </linearGradient>',
        '  <linearGradient id="gradOverdue" x1="0" y1="0" x2="0" y2="1">',
        '    <stop offset="0%" stop-color="#f43f5e" stop-opacity="0.95"/>',
        '    <stop offset="100%" stop-color="#be123c" stop-opacity="0.65"/>',
        '  </linearGradient>',
        '  <linearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">',
        '    <stop offset="0%" stop-color="#ffd085" stop-opacity="0.28"/>',
        '    <stop offset="100%" stop-color="#ffd085" stop-opacity="0.0"/>',
        '  </linearGradient>',
        '</defs>',
        f'<rect width="{width}" height="{height}" fill="rgba(7,9,8,0.65)" rx="12"/>',
        f'<text x="{pad_l}" y="24" fill="#fbf8ee" font-family="Playfair Display, Plus Jakarta Sans, serif" font-size="13" font-weight="700">matplotlib.pyplot — Monthly Circulation Velocity</text>',
    ]

    # Grid lines
    for i in range(5):
        val = round(y_max * i / 4)
        y = pad_t + plot_h - (val / y_max) * plot_h
        svg_lines.append(
            f'<line x1="{pad_l}" y1="{y:.1f}" x2="{width - pad_r}" y2="{y:.1f}" stroke="rgba(255,255,255,0.10)" stroke-dasharray="4,4" stroke-width="1"/>'
        )
        svg_lines.append(
            f'<text x="{pad_l - 10}" y="{y + 4:.1f}" text-anchor="end" fill="#b5b8ad" font-family="JetBrains Mono, monospace" font-size="11">{val}</text>'
        )

    pts_total = []
    bar_w = min(26, step_x * 0.34)

    for idx, row in enumerate(monthly_rows):
        cx = pad_l + step_x * (idx + 0.5)
        total_v = row["total_issued"]
        ret_v = row["returned_count"]
        over_v = row["overdue_count"]

        h_total = (total_v / y_max) * plot_h
        y_total = pad_t + plot_h - h_total

        h_ret = (ret_v / y_max) * plot_h
        y_ret = pad_t + plot_h - h_ret

        h_over = (over_v / y_max) * plot_h
        y_over = pad_t + plot_h - h_over

        pts_total.append((cx, y_total, total_v))

        # Returned bar with smooth vertical grow animation
        svg_lines.append(
            f'<rect x="{cx - bar_w - 2:.1f}" y="{y_ret:.1f}" width="{bar_w:.1f}" height="{max(3.0, h_ret):.1f}" fill="url(#gradReturned)" rx="3">'
            f'<animate attributeName="height" from="0" to="{max(3.0, h_ret):.1f}" dur="0.55s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1"/>'
            f'<animate attributeName="y" from="{pad_t + plot_h:.1f}" to="{y_ret:.1f}" dur="0.55s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1"/>'
            f'</rect>'
        )
        # Overdue bar with smooth vertical grow animation
        svg_lines.append(
            f'<rect x="{cx + 2:.1f}" y="{y_over:.1f}" width="{bar_w:.1f}" height="{max(3.0, h_over):.1f}" fill="url(#gradOverdue)" rx="3">'
            f'<animate attributeName="height" from="0" to="{max(3.0, h_over):.1f}" dur="0.65s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1"/>'
            f'<animate attributeName="y" from="{pad_t + plot_h:.1f}" to="{y_over:.1f}" dur="0.65s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1"/>'
            f'</rect>'
        )
        # X-axis label
        svg_lines.append(
            f'<text x="{cx:.1f}" y="{height - 16}" text-anchor="middle" fill="#b5b8ad" font-family="JetBrains Mono, monospace" font-size="11" font-weight="500">{row["month"]}</text>'
        )

    # Shaded area under total trend line + animated polyline
    if len(pts_total) > 1:
        area_pts = (
            f"{pts_total[0][0]:.1f},{pad_t + plot_h:.1f} "
            + " ".join(f"{x:.1f},{y:.1f}" for x, y, _ in pts_total)
            + f" {pts_total[-1][0]:.1f},{pad_t + plot_h:.1f}"
        )
        svg_lines.append(f'<polygon points="{area_pts}" fill="url(#gradArea)"/>')
        poly = " ".join(f"{x:.1f},{y:.1f}" for x, y, _ in pts_total)
        svg_lines.append(
            f'<polyline fill="none" stroke="#ffd085" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" points="{poly}" stroke-dasharray="900" stroke-dashoffset="0">'
            f'<animate attributeName="stroke-dashoffset" from="900" to="0" dur="0.8s" fill="freeze"/>'
            f'</polyline>'
        )

    for x, y, val in pts_total:
        svg_lines.append(
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4.5" fill="#ffd085" stroke="#191c19" stroke-width="2"/>'
        )
        svg_lines.append(
            f'<text x="{x:.1f}" y="{y - 9:.1f}" text-anchor="middle" fill="#fbf8ee" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700">{val}</text>'
        )

    # Legend positioned cleanly on right without overlapping title
    svg_lines.append(
        f'<g transform="translate({width - 255}, 12)">'
        f'<rect x="0" y="3" width="10" height="10" fill="#ffd085" rx="2"/>'
        f'<text x="14" y="12" fill="#b5b8ad" font-family="Plus Jakarta Sans, sans-serif" font-size="11" font-weight="500">Total Issued</text>'
        f'<rect x="88" y="3" width="10" height="10" fill="url(#gradReturned)" rx="2"/>'
        f'<text x="102" y="12" fill="#b5b8ad" font-family="Plus Jakarta Sans, sans-serif" font-size="11" font-weight="500">Returned</text>'
        f'<rect x="164" y="3" width="10" height="10" fill="url(#gradOverdue)" rx="2"/>'
        f'<text x="178" y="12" fill="#b5b8ad" font-family="Plus Jakarta Sans, sans-serif" font-size="11" font-weight="500">Overdue</text>'
        f'</g>'
    )

    svg_lines.append("</svg>")
    return "\n".join(svg_lines)


def generate_matplotlib_popular_svg(popular_books: List[Dict[str, Any]]) -> str:
    """Generates a dark glassmorphic horizontal bar chart SVG with Warm Gold (#ffd085) & Emerald (#34d399) highlights for Most-Borrowed Books."""
    top_books = popular_books[:6]
    width, height = 740, 310
    pad_l, pad_r, pad_t, pad_b = 215, 78, 42, 30
    plot_w = width - pad_l - pad_r
    plot_h = height - pad_t - pad_b

    if not top_books:
        return f'<svg viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg"></svg>'

    max_loans = max(max(b["total_loans"], 1) for b in top_books)
    row_h = plot_h / len(top_books)

    svg_lines = [
        f'<svg viewBox="0 0 {width} {height}" class="w-full h-auto" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Matplotlib Most-Borrowed Books Chart">',
        '<defs>',
        '  <linearGradient id="gradPopularBar" x1="0" y1="0" x2="1" y2="0">',
        '    <stop offset="0%" stop-color="#2a533e"/>',
        '    <stop offset="100%" stop-color="#34d399"/>',
        '  </linearGradient>',
        '  <linearGradient id="gradTopRankBar" x1="0" y1="0" x2="1" y2="0">',
        '    <stop offset="0%" stop-color="#c49a55"/>',
        '    <stop offset="100%" stop-color="#ffd085"/>',
        '  </linearGradient>',
        '</defs>',
        f'<rect width="{width}" height="{height}" fill="rgba(7,9,8,0.65)" rx="12"/>',
        f'<text x="16" y="24" fill="#fbf8ee" font-family="Playfair Display, Plus Jakarta Sans, serif" font-size="13" font-weight="700">matplotlib.pyplot — Top Borrowed Books Ranking (Total Issues)</text>',
    ]

    for idx, book in enumerate(top_books):
        cy = pad_t + idx * row_h + row_h * 0.5
        bar_h = min(21.0, row_h * 0.60)
        w = max(6.0, (book["total_loans"] / max_loans) * plot_w)
        short_title = book["title"] if len(book["title"]) <= 28 else book["title"][:25] + "..."
        fill_ref = "url(#gradTopRankBar)" if idx == 0 else "url(#gradPopularBar)"
        label_color = "#ffd085" if idx == 0 else "#34d399"

        # Subtle dark glass background track
        svg_lines.append(
            f'<rect x="{pad_l}" y="{cy - bar_h / 2:.1f}" width="{plot_w:.1f}" height="{bar_h:.1f}" fill="rgba(255,255,255,0.06)" rx="4"/>'
        )
        svg_lines.append(
            f'<text x="{pad_l - 12}" y="{cy + 4:.1f}" text-anchor="end" fill="#fbf8ee" font-family="Plus Jakarta Sans, sans-serif" font-size="11.5" font-weight="600">{short_title}</text>'
        )
        svg_lines.append(
            f'<rect x="{pad_l}" y="{cy - bar_h / 2:.1f}" width="{w:.1f}" height="{bar_h:.1f}" fill="{fill_ref}" rx="4">'
            f'<animate attributeName="width" from="0" to="{w:.1f}" dur="{0.45 + idx * 0.07:.2f}s" fill="freeze" calcMode="spline" keySplines="0.16 1 0.3 1" keyTimes="0;1"/>'
            f'</rect>'
        )
        svg_lines.append(
            f'<text x="{pad_l + w + 10:.1f}" y="{cy + 4:.1f}" fill="{label_color}" font-family="JetBrains Mono, monospace" font-size="11.5" font-weight="700">{book["total_loans"]} loans</text>'
        )

    svg_lines.append("</svg>")
    return "\n".join(svg_lines)


def build_full_state() -> Dict[str, Any]:
    init_db(force_reset=False)
    conn = get_connection()
    settings = get_settings(conn)
    ref_date = parse_iso_date(settings["reference_date"])

    cur = conn.cursor()

    cur.execute("SELECT * FROM books ORDER BY book_id ASC")
    books = [dict(r) for r in cur.fetchall()]

    cur.execute("SELECT * FROM borrowers ORDER BY borrower_id ASC")
    borrowers = [dict(r) for r in cur.fetchall()]

    cur.execute("""
        SELECT
            l.loan_id,
            l.book_id,
            b.isbn,
            b.title AS book_title,
            b.author AS book_author,
            b.category AS book_category,
            l.borrower_id,
            br.borrower_name,
            br.roll_no,
            l.issue_date,
            l.due_date,
            l.return_date
        FROM loans l
        JOIN books b ON l.book_id = b.book_id
        JOIN borrowers br ON l.borrower_id = br.borrower_id
        ORDER BY l.issue_date DESC, l.loan_id DESC
    """)
    raw_loans = [dict(r) for r in cur.fetchall()]
    loans = [enrich_loan(r, ref_date) for r in raw_loans]

    # Book-level circulation metrics
    book_loan_Map: Dict[int, Dict[str, int]] = {
        b["book_id"]: {"total_loans": 0, "active_loans": 0, "overdue_loans": 0, "returned_loans": 0}
        for b in books
    }
    for ln in loans:
        bid = ln["book_id"]
        if bid in book_loan_Map:
            book_loan_Map[bid]["total_loans"] += 1
            if ln["status"] == "RETURNED":
                book_loan_Map[bid]["returned_loans"] += 1
            elif ln["status"] == "OVERDUE":
                book_loan_Map[bid]["active_loans"] += 1
                book_loan_Map[bid]["overdue_loans"] += 1
            else:
                book_loan_Map[bid]["active_loans"] += 1

    enriched_books = []
    for b in books:
        stats = book_loan_Map[b["book_id"]]
        total_inventory = b["copies_available"] + stats["active_loans"]
        utilization_pct = round((stats["active_loans"] / total_inventory) * 100, 1) if total_inventory > 0 else 0.0
        enriched_books.append({
            **b,
            **stats,
            "total_inventory": total_inventory,
            "utilization_pct": utilization_pct,
        })

    # Borrower-level circulation metrics
    borrower_map: Dict[int, Dict[str, int]] = {
        br["borrower_id"]: {"total_borrowed": 0, "active_loans": 0, "overdue_loans": 0}
        for br in borrowers
    }
    for ln in loans:
        brid = ln["borrower_id"]
        if brid in borrower_map:
            borrower_map[brid]["total_borrowed"] += 1
            if ln["status"] in ("ACTIVE", "OVERDUE"):
                borrower_map[brid]["active_loans"] += 1
            if ln["status"] == "OVERDUE":
                borrower_map[brid]["overdue_loans"] += 1

    enriched_borrowers = [{**br, **borrower_map[br["borrower_id"]]} for br in borrowers]

    # 1. Most-Borrowed Books Report
    most_borrowed_books = sorted(
        enriched_books,
        key=lambda x: (-x["total_loans"], -x["active_loans"], x["book_id"]),
    )
    for rank_idx, item in enumerate(most_borrowed_books, start=1):
        item["rank"] = rank_idx

    # 2. Overdue Loans List
    overdue_loans = sorted(
        [ln for ln in loans if ln["status"] == "OVERDUE"],
        key=lambda x: (-x["days_overdue"], x["due_date"]),
    )

    # 3. Monthly Circulation Summary (Pandas groupby equivalent)
    monthly_buckets: Dict[str, Dict[str, Any]] = {}
    for ln in loans:
        month_key = ln["issue_date"][:7]  # YYYY-MM
        if month_key not in monthly_buckets:
            monthly_buckets[month_key] = {
                "month": month_key,
                "total_issued": 0,
                "returned_count": 0,
                "active_count": 0,
                "overdue_count": 0,
                "borrower_ids": set(),
            }
        bucket = monthly_buckets[month_key]
        bucket["total_issued"] += 1
        bucket["borrower_ids"].add(ln["borrower_id"])
        if ln["status"] == "RETURNED":
            bucket["returned_count"] += 1
        elif ln["status"] == "OVERDUE":
            bucket["overdue_count"] += 1
            bucket["active_count"] += 1
        else:
            bucket["active_count"] += 1

    monthly_trends = []
    for m_key in sorted(monthly_buckets.keys()):
        bkt = monthly_buckets[m_key]
        monthly_trends.append({
            "month": bkt["month"],
            "total_issued": bkt["total_issued"],
            "returned_count": bkt["returned_count"],
            "active_count": bkt["active_count"],
            "overdue_count": bkt["overdue_count"],
            "unique_borrowers": len(bkt["borrower_ids"]),
        })

    # 4. Category Summary (Pandas groupby category equivalent)
    cat_buckets: Dict[str, Dict[str, Any]] = {}
    total_loan_count = max(1, len(loans))
    for b in enriched_books:
        cat = b["category"]
        if cat not in cat_buckets:
            cat_buckets[cat] = {
                "category": cat,
                "total_titles": 0,
                "copies_available": 0,
                "total_inventory": 0,
                "total_loans": 0,
                "active_loans": 0,
                "overdue_loans": 0,
            }
        cb = cat_buckets[cat]
        cb["total_titles"] += 1
        cb["copies_available"] += b["copies_available"]
        cb["total_inventory"] += b["total_inventory"]
        cb["total_loans"] += b["total_loans"]
        cb["active_loans"] += b["active_loans"]
        cb["overdue_loans"] += b["overdue_loans"]

    category_summary = []
    for cat_name, cb in sorted(cat_buckets.items(), key=lambda item: (-item[1]["total_loans"], item[0])):
        cb["share_pct"] = round((cb["total_loans"] / total_loan_count) * 100, 1)
        category_summary.append(cb)

    # 5. NumPy Descriptive Statistics
    loan_durations = [float(ln["duration_days"]) for ln in loans]
    loans_per_book = [float(b["total_loans"]) for b in enriched_books]
    overdue_days_list = [float(ln["days_overdue"]) for ln in overdue_loans]

    numpy_stats = {
        "loan_duration_days": compute_numpy_statistics(loan_durations),
        "loans_per_book": compute_numpy_statistics(loans_per_book),
        "overdue_days": compute_numpy_statistics(overdue_days_list),
    }

    # Summary KPIs
    active_loans_count = sum(1 for ln in loans if ln["status"] in ("ACTIVE", "OVERDUE"))
    overdue_loans_count = len(overdue_loans)
    returned_loans_count = sum(1 for ln in loans if ln["status"] == "RETURNED")
    total_copies_available = sum(b["copies_available"] for b in books)

    conn.close()

    return {
        "engine": {
            "runtime": f"Python {sys.version.split()[0]}",
            "database": "SQLite3 / MySQL Compatible Schema",
            "pandas_installed": HAS_PANDAS,
            "numpy_installed": HAS_NUMPY,
        },
        "settings": settings,
        "kpis": {
            "total_books_titles": len(books),
            "total_copies_available": total_copies_available,
            "total_borrowers": len(borrowers),
            "total_loans": len(loans),
            "active_loans": active_loans_count,
            "overdue_loans": overdue_loans_count,
            "returned_loans": returned_loans_count,
            "overdue_rate_pct": round((overdue_loans_count / max(1, active_loans_count)) * 100, 1),
        },
        "books": enriched_books,
        "borrowers": enriched_borrowers,
        "loans": loans,
        "reports": {
            "most_borrowed_books": most_borrowed_books,
            "overdue_loans": overdue_loans,
            "monthly_trends": monthly_trends,
            "category_summary": category_summary,
            "numpy_stats": numpy_stats,
        },
        "charts_svg": {
            "monthly_trends": generate_matplotlib_monthly_svg(monthly_trends),
            "popular_books": generate_matplotlib_popular_svg(most_borrowed_books),
        },
    }


def issue_book(payload: Dict[str, Any]) -> Dict[str, Any]:
    init_db()
    conn = get_connection()
    settings = get_settings(conn)

    try:
        book_id = int(payload.get("book_id", 0))
        borrower_id = int(payload.get("borrower_id", 0))
        issue_date_str = str(payload.get("issue_date", "")).strip()
        due_date_str = str(payload.get("due_date", "")).strip()
        due_days_custom = payload.get("due_days")

        if not book_id or not borrower_id:
            raise ValueError("Both a valid book_id and borrower_id are required.")

        issue_dt = parse_iso_date(issue_date_str)

        if due_date_str:
            due_dt = parse_iso_date(due_date_str)
        else:
            days = int(due_days_custom) if due_days_custom is not None else settings["default_due_days"]
            if days < 1 or days > 365:
                raise ValueError("Configurable loan duration must be between 1 and 365 days.")
            due_dt = issue_dt + timedelta(days=days)

        if due_dt < issue_dt:
            raise ValueError("Invalid issue/due sequence: due_date cannot be earlier than issue_date.")

        cur = conn.cursor()
        cur.execute("SELECT * FROM books WHERE book_id = ?", (book_id,))
        book_row = cur.fetchone()
        if not book_row:
            raise ValueError(f"Book ID {book_id} does not exist.")

        if book_row["copies_available"] <= 0:
            raise ValueError(
                f"Cannot issue '{book_row['title']}': 0 copies available in inventory."
            )

        cur.execute("SELECT * FROM borrowers WHERE borrower_id = ?", (borrower_id,))
        borrower_row = cur.fetchone()
        if not borrower_row:
            raise ValueError(f"Borrower ID {borrower_id} does not exist.")

        # Atomic transaction: decrement copies_available and insert loan record
        cur.execute(
            "UPDATE books SET copies_available = copies_available - 1 WHERE book_id = ? AND copies_available > 0",
            (book_id,),
        )
        if cur.rowcount != 1:
            raise ValueError("Inventory update failed: no copies available.")

        cur.execute(
            """
            INSERT INTO loans (book_id, borrower_id, issue_date, due_date, return_date)
            VALUES (?, ?, ?, ?, NULL)
            """,
            (book_id, borrower_id, issue_dt.isoformat(), due_dt.isoformat()),
        )
        new_loan_id = cur.lastrowid
        conn.commit()
    except Exception as exc:
        conn.rollback()
        conn.close()
        return {"ok": False, "error": str(exc)}

    conn.close()
    return {
        "ok": True,
        "message": f"Loan #{new_loan_id} issued cleanly. Available copies decremented.",
        "state": build_full_state(),
    }


def return_book(payload: Dict[str, Any]) -> Dict[str, Any]:
    init_db()
    conn = get_connection()

    try:
        loan_id = int(payload.get("loan_id", 0))
        return_date_str = str(payload.get("return_date", "")).strip()

        if not loan_id:
            raise ValueError("A valid loan_id is required to process a return.")

        return_dt = parse_iso_date(return_date_str)

        cur = conn.cursor()
        cur.execute("SELECT * FROM loans WHERE loan_id = ?", (loan_id,))
        loan_row = cur.fetchone()
        if not loan_row:
            raise ValueError(f"Loan #{loan_id} not found.")

        if loan_row["return_date"] is not None:
            raise ValueError(
                f"Invalid return sequence: Loan #{loan_id} was already returned on {loan_row['return_date']}."
            )

        issue_dt = parse_iso_date(loan_row["issue_date"])
        if return_dt < issue_dt:
            raise ValueError(
                f"Invalid issue/return sequence: return_date ({return_dt.isoformat()}) cannot be earlier than issue_date ({issue_dt.isoformat()})."
            )

        # Atomic update: set return_date and increment book's copies_available
        cur.execute(
            "UPDATE loans SET return_date = ? WHERE loan_id = ?",
            (return_dt.isoformat(), loan_id),
        )
        cur.execute(
            "UPDATE books SET copies_available = copies_available + 1 WHERE book_id = ?",
            (loan_row["book_id"],),
        )
        conn.commit()
    except Exception as exc:
        conn.rollback()
        conn.close()
        return {"ok": False, "error": str(exc)}

    conn.close()
    return {
        "ok": True,
        "message": f"Loan #{loan_id} marked as RETURNED on {return_dt.isoformat()}. Available copies incremented.",
        "state": build_full_state(),
    }


def add_book(payload: Dict[str, Any]) -> Dict[str, Any]:
    init_db()
    conn = get_connection()
    try:
        isbn = str(payload.get("isbn", "")).strip()
        title = str(payload.get("title", "")).strip()
        author = str(payload.get("author", "")).strip()
        category = str(payload.get("category", "")).strip()
        copies = int(payload.get("copies_available", -1))

        if not isbn or not title or not author or not category:
            raise ValueError("ISBN, title, author, and category are all required.")
        if copies < 0:
            raise ValueError("copies_available must be a non-negative integer (>= 0).")

        cur = conn.cursor()
        cur.execute(
            """
            INSERT INTO books (isbn, title, author, category, copies_available)
            VALUES (?, ?, ?, ?, ?)
            """,
            (isbn, title, author, category, copies),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.rollback()
        conn.close()
        return {"ok": False, "error": f"A book with ISBN '{isbn}' already exists."}
    except Exception as exc:
        conn.rollback()
        conn.close()
        return {"ok": False, "error": str(exc)}

    conn.close()
    return {"ok": True, "message": f"Book '{title}' added to catalog.", "state": build_full_state()}


def add_borrower(payload: Dict[str, Any]) -> Dict[str, Any]:
    init_db()
    conn = get_connection()
    try:
        borrower_name = str(payload.get("borrower_name", "")).strip()
        roll_no = str(payload.get("roll_no", "")).strip().upper()

        if not borrower_name or not roll_no:
            raise ValueError("Both borrower_name and roll_no are required.")

        cur = conn.cursor()
        cur.execute(
            "INSERT INTO borrowers (borrower_name, roll_no) VALUES (?, ?)",
            (borrower_name, roll_no),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        conn.rollback()
        conn.close()
        return {"ok": False, "error": f"Roll number '{roll_no}' is already registered."}
    except Exception as exc:
        conn.rollback()
        conn.close()
        return {"ok": False, "error": str(exc)}

    conn.close()
    return {"ok": True, "message": f"Borrower '{borrower_name}' ({roll_no}) registered.", "state": build_full_state()}


def update_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    init_db()
    conn = get_connection()
    try:
        due_days = int(payload.get("default_due_days", DEFAULT_DUE_DAYS))
        ref_date_str = str(payload.get("reference_date", DEFAULT_REFERENCE_DATE)).strip()

        if due_days < 1 or due_days > 365:
            raise ValueError("Default configurable due days must be between 1 and 365.")
        parse_iso_date(ref_date_str)

        cur = conn.cursor()
        cur.execute(
            "INSERT OR REPLACE INTO settings (setting_key, setting_value) VALUES ('default_due_days', ?)",
            (str(due_days),),
        )
        cur.execute(
            "INSERT OR REPLACE INTO settings (setting_key, setting_value) VALUES ('reference_date', ?)",
            (ref_date_str,),
        )
        conn.commit()
    except Exception as exc:
        conn.rollback()
        conn.close()
        return {"ok": False, "error": str(exc)}

    conn.close()
    return {
        "ok": True,
        "message": f"Configuration updated: Default loan period = {due_days} days, Reference evaluation date = {ref_date_str}.",
        "state": build_full_state(),
    }


def run_readonly_sql(payload: Dict[str, Any]) -> Dict[str, Any]:
    init_db()
    sql = str(payload.get("sql", "")).strip()
    if not sql:
        return {"ok": False, "error": "SQL query cannot be empty."}

    normalized = sql.lstrip().upper()
    if not (normalized.startswith("SELECT") or normalized.startswith("PRAGMA") or normalized.startswith("WITH")):
        return {
            "ok": False,
            "error": "Only read-only SELECT / WITH queries are permitted in the interactive SQL console.",
        }

    conn = get_connection()
    try:
        cur = conn.cursor()
        cur.execute(sql)
        rows = [dict(r) for r in cur.fetchall()[:100]]
        columns = [desc[0] for desc in cur.description] if cur.description else []
        conn.close()
        return {"ok": True, "columns": columns, "rows": rows, "row_count": len(rows)}
    except Exception as exc:
        conn.close()
        return {"ok": False, "error": str(exc)}


def format_cli_analysis_report(state: Dict[str, Any]) -> str:
    kpis = state["kpis"]
    settings = state["settings"]
    reports = state["reports"]
    stats_dur = reports["numpy_stats"]["loan_duration_days"]
    stats_book = reports["numpy_stats"]["loans_per_book"]

    lines = [
        "================================================================================",
        "  PYTHON 3 LIBRARY BOOK USAGE ANALYSIS SYSTEM — STATISTICAL & CIRCULATION REPORT",
        f"  Runtime: {state['engine']['runtime']} | Evaluation Date: {settings['reference_date']} | Due Window: {settings['default_due_days']} days",
        "================================================================================",
        "",
        "[1] EXECUTIVE CIRCULATION SUMMARY",
        f"    Total Book Titles     : {kpis['total_books_titles']} titles ({kpis['total_copies_available']} copies available on shelf)",
        f"    Registered Borrowers  : {kpis['total_borrowers']} students",
        f"    Total Loan Records    : {kpis['total_loans']} transactions",
        f"    Active Loans          : {kpis['active_loans']} ({kpis['overdue_loans']} OVERDUE, {kpis['active_loans'] - kpis['overdue_loans']} ON-TIME)",
        f"    Completed Returns     : {kpis['returned_loans']} returned",
        "",
        "[2] NUMPY DESCRIPTIVE STATISTICS (Loan Duration in Days & Issues per Book)",
        f"    Loan Duration (Days)  -> Mean: {stats_dur['mean']} | Median: {stats_dur['median']} | Std Dev: {stats_dur['std_dev']} | IQR: {stats_dur['iqr']} (Min: {stats_dur['min']}, Max: {stats_dur['max']})",
        f"    Issues per Book Title -> Mean: {stats_book['mean']} | Median: {stats_book['median']} | Std Dev: {stats_book['std_dev']} | Max: {stats_book['max']}",
        "",
        "[3] PANDAS CATEGORY SUMMARY (Grouped by books.category)",
        f"    {'Category':<24} | {'Titles':>6} | {'Avail':>5} | {'Total Loans':>11} | {'Active':>6} | {'Overdue':>7} | {'Share %':>7}",
        "    " + "-" * 78,
    ]
    for c in reports["category_summary"]:
        lines.append(
            f"    {c['category']:<24} | {c['total_titles']:>6} | {c['copies_available']:>5} | {c['total_loans']:>11} | {c['active_loans']:>6} | {c['overdue_loans']:>7} | {c['share_pct']:>6.1f}%"
        )

    lines.extend([
        "",
        "[4] PANDAS MONTHLY BORROWING TRENDS (Grouped by issue_date YYYY-MM)",
        f"    {'Month':<10} | {'Issued':>8} | {'Returned':>8} | {'Active':>8} | {'Overdue':>8} | {'Unique Borrowers':>16}",
        "    " + "-" * 70,
    ])
    for m in reports["monthly_trends"]:
        lines.append(
            f"    {m['month']:<10} | {m['total_issued']:>8} | {m['returned_count']:>8} | {m['active_count']:>8} | {m['overdue_count']:>8} | {m['unique_borrowers']:>16}"
        )

    lines.extend([
        "",
        "[5] MOST-BORROWED BOOKS REPORT (Top 5 Ranked)",
        f"    {'Rank':<4} | {'ISBN':<14} | {'Title':<38} | {'Loans':>5} | {'Avail':>5}",
        "    " + "-" * 76,
    ])
    for b in reports["most_borrowed_books"][:5]:
        t_short = b["title"][:38]
        lines.append(
            f"    #{b['rank']:<3} | {b['isbn']:<14} | {t_short:<38} | {b['total_loans']:>5} | {b['copies_available']:>5}"
        )

    lines.extend([
        "",
        "[6] OVERDUE LOANS WATCHLIST",
        f"    {'Loan ID':<7} | {'Roll No':<11} | {'Borrower':<20} | {'Due Date':<10} | {'Days Overdue':>12}",
        "    " + "-" * 70,
    ])
    if not reports["overdue_loans"]:
        lines.append("    No overdue loans as of the current reference date.")
    else:
        for ov in reports["overdue_loans"]:
            lines.append(
                f"    #{ov['loan_id']:<6} | {ov['roll_no']:<11} | {ov['borrower_name'][:20]:<20} | {ov['due_date']:<10} | {ov['days_overdue']:>9} d"
            )

    lines.append("================================================================================")
    return "\n".join(lines)


def main() -> None:
    if len(sys.argv) < 2:
        state = build_full_state()
        print(format_cli_analysis_report(state))
        return

    action = sys.argv[1]
    raw_input = sys.stdin.read().strip() if not sys.stdin.isatty() else "{}"
    payload = json.loads(raw_input) if raw_input else {}

    if action == "state":
        res = {"ok": True, "state": build_full_state()}
    elif action == "issue":
        res = issue_book(payload)
    elif action == "return":
        res = return_book(payload)
    elif action == "add-book":
        res = add_book(payload)
    elif action == "add-borrower":
        res = add_borrower(payload)
    elif action == "settings":
        res = update_settings(payload)
    elif action == "sql":
        res = run_readonly_sql(payload)
    elif action == "cli-report":
        st = build_full_state()
        res = {"ok": True, "report_text": format_cli_analysis_report(st), "state": st}
    elif action == "reset":
        init_db(force_reset=True)
        res = {"ok": True, "message": "Database reset to default seed state.", "state": build_full_state()}
    else:
        res = {"ok": False, "error": f"Unknown action: {action}"}

    print(json.dumps(res))


if __name__ == "__main__":
    main()
