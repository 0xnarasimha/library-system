-- ============================================================================
-- Project 5: Library Book Usage Analysis System
-- MySQL 8.0 / MariaDB / SQLite Relational Schema & Seed Data
-- ============================================================================

CREATE DATABASE IF NOT EXISTS library_usage_db;
USE library_usage_db;

DROP TABLE IF EXISTS loans;
DROP TABLE IF EXISTS borrowers;
DROP TABLE IF EXISTS books;

-- 1. Books Table
CREATE TABLE books (
    book_id INT AUTO_INCREMENT PRIMARY KEY,
    isbn VARCHAR(20) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    author VARCHAR(150) NOT NULL,
    category VARCHAR(100) NOT NULL,
    copies_available INT NOT NULL DEFAULT 1 CHECK (copies_available >= 0)
);

-- 2. Borrowers Table
CREATE TABLE borrowers (
    borrower_id INT AUTO_INCREMENT PRIMARY KEY,
    borrower_name VARCHAR(150) NOT NULL,
    roll_no VARCHAR(40) NOT NULL UNIQUE
);

-- 3. Loans Circulation Table
CREATE TABLE loans (
    loan_id INT AUTO_INCREMENT PRIMARY KEY,
    book_id INT NOT NULL,
    borrower_id INT NOT NULL,
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    return_date DATE DEFAULT NULL,
    CONSTRAINT fk_loans_book FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
    CONSTRAINT fk_loans_borrower FOREIGN KEY (borrower_id) REFERENCES borrowers(borrower_id) ON DELETE CASCADE,
    CONSTRAINT chk_valid_due CHECK (due_date >= issue_date),
    CONSTRAINT chk_valid_return CHECK (return_date IS NULL OR return_date >= issue_date)
);

-- Analytical Queries for Reports:

-- A. Most-Borrowed Books Report
SELECT
    b.book_id,
    b.isbn,
    b.title,
    b.author,
    b.category,
    b.copies_available,
    COUNT(l.loan_id) AS total_loans,
    SUM(CASE WHEN l.return_date IS NULL THEN 1 ELSE 0 END) AS active_loans
FROM books b
LEFT JOIN loans l ON b.book_id = l.book_id
GROUP BY b.book_id, b.isbn, b.title, b.author, b.category, b.copies_available
ORDER BY total_loans DESC, active_loans DESC;

-- B. Overdue Loans List (Configurable Reference Date)
SELECT
    l.loan_id,
    b.title AS book_title,
    br.borrower_name,
    br.roll_no,
    l.issue_date,
    l.due_date,
    DATEDIFF(CURRENT_DATE, l.due_date) AS days_overdue
FROM loans l
JOIN books b ON l.book_id = b.book_id
JOIN borrowers br ON l.borrower_id = br.borrower_id
WHERE l.return_date IS NULL
  AND l.due_date < CURRENT_DATE
ORDER BY days_overdue DESC;
