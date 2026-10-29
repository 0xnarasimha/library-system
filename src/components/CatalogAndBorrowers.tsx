import React, { useState } from 'react';
import type { BookRecord, BorrowerRecord } from '../utils/circulationRules';
import type { AppRoutePath } from '../App';

export type CatalogSubRoute = 'books' | 'borrowers';

interface CatalogAndBorrowersProps {
  subRoute: CatalogSubRoute;
  onNavigateRoute: (path: AppRoutePath) => void;
  books: BookRecord[];
  borrowers: BorrowerRecord[];
  onAddBook: (payload: {
    isbn: string;
    title: string;
    author: string;
    category: string;
    copies_available: number;
  }) => Promise<{ ok: boolean; error?: string; message?: string }>;
  onAddBorrower: (payload: {
    borrower_name: string;
    roll_no: string;
  }) => Promise<{ ok: boolean; error?: string; message?: string }>;
  isBusy: boolean;
}

export const CatalogAndBorrowers: React.FC<CatalogAndBorrowersProps> = ({
  subRoute,
  books,
  borrowers,
  onAddBook,
  onAddBorrower,
  isBusy,
}) => {
  // Add Book Form
  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('Data Science');
  const [copiesAvailable, setCopiesAvailable] = useState<number>(3);
  const [bookMsg, setBookMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Add Borrower Form
  const [borrowerName, setBorrowerName] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [borrowerMsg, setBorrowerMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Filter
  const [bookSearch, setBookSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [borrowerSearch, setBorrowerSearch] = useState('');

  const categories = Array.from(new Set(books.map((b) => b.category))).sort();

  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    setBookMsg(null);

    if (!isbn.trim() || !title.trim() || !author.trim() || !category.trim()) {
      setBookMsg({
        type: 'error',
        text: 'ISBN, Book Title, Author, and Category are all required fields.',
      });
      return;
    }

    if (copiesAvailable < 0) {
      setBookMsg({
        type: 'error',
        text: 'Available copies must be 0 or greater.',
      });
      return;
    }

    const res = await onAddBook({
      isbn: isbn.trim(),
      title: title.trim(),
      author: author.trim(),
      category: category.trim(),
      copies_available: Number(copiesAvailable),
    });

    if (!res.ok) {
      setBookMsg({ type: 'error', text: res.error || 'Could not add book.' });
    } else {
      setBookMsg({ type: 'success', text: res.message || 'Book added to relational table.' });
      setIsbn('');
      setTitle('');
      setAuthor('');
      setCopiesAvailable(3);
    }
  };

  const handleCreateBorrower = async (e: React.FormEvent) => {
    e.preventDefault();
    setBorrowerMsg(null);

    if (!borrowerName.trim() || !rollNo.trim()) {
      setBorrowerMsg({
        type: 'error',
        text: 'Both Student Name and Roll Number are required.',
      });
      return;
    }

    const res = await onAddBorrower({
      borrower_name: borrowerName.trim(),
      roll_no: rollNo.trim().toUpperCase(),
    });

    if (!res.ok) {
      setBorrowerMsg({ type: 'error', text: res.error || 'Could not register borrower.' });
    } else {
      setBorrowerMsg({ type: 'success', text: res.message || 'Borrower added.' });
      setBorrowerName('');
      setRollNo('');
    }
  };

  const filteredBooks = books.filter((b) => {
    if (categoryFilter !== 'ALL' && b.category !== categoryFilter) return false;
    if (bookSearch.trim()) {
      const q = bookSearch.toLowerCase();
      return (
        b.title.toLowerCase().includes(q) ||
        b.author.toLowerCase().includes(q) ||
        b.isbn.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const filteredBorrowers = borrowers.filter((br) => {
    if (!borrowerSearch.trim()) return true;
    const q = borrowerSearch.toLowerCase();
    return (
      br.borrower_name.toLowerCase().includes(q) ||
      br.roll_no.toLowerCase().includes(q)
    );
  });

  if (subRoute === 'borrowers') {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 4 Cols: Add Borrower Record */}
        <section
          aria-label="Add Borrower Record"
          className="lg:col-span-4 apple-glass glass-edge-sweep p-6 sm:p-7"
        >
          <div className="text-xs font-mono text-[#ffd085]">
            borrowers(borrower_id, borrower_name, roll_no)
          </div>
          <h2 className="mt-1 font-serif text-2xl font-bold text-[#fbf8ee]">
            Register Student / Faculty Borrower
          </h2>
          <p className="text-xs text-[#b5b8ad] mt-1">
            Adds a borrower entity with unique university roll number for circulation tracking.
          </p>

          <form onSubmit={handleCreateBorrower} className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="borrower-name-input"
                className="block text-xs font-mono uppercase tracking-wider text-[#d8dad0] mb-1.5"
              >
                Full Name
              </label>
              <input
                id="borrower-name-input"
                type="text"
                placeholder="Neha Kulkarni"
                value={borrowerName}
                onChange={(e) => setBorrowerName(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-black/55 text-[#fbf8ee] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd085]/60"
              />
            </div>

            <div>
              <label
                htmlFor="borrower-roll-input"
                className="block text-xs font-mono uppercase tracking-wider text-[#d8dad0] mb-1.5"
              >
                University Roll Number (Unique)
              </label>
              <input
                id="borrower-roll-input"
                type="text"
                placeholder="CS2024-089"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                className="w-full px-3.5 py-2 text-sm font-mono bg-black/55 text-[#fbf8ee] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd085]/60"
              />
            </div>

            {borrowerMsg && (
              <div
                role="alert"
                className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                  borrowerMsg.type === 'error'
                    ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                    : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {borrowerMsg.type === 'error' ? 'warning' : 'check_circle'}
                </span>
                <span>{borrowerMsg.text}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isBusy}
              className="w-full py-3 px-4 rounded-xl bg-[#ffd085] hover:bg-[#ffe0a3] text-[#191c19] font-mono text-xs font-bold shadow-[0_8px_24px_rgba(255,208,133,0.28)] transition-all cursor-pointer disabled:opacity-50"
            >
              Register Borrower
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-[#b5b8ad] font-mono">
            <span>Total Borrowers: {borrowers.length}</span>
            <span className="text-emerald-400">Unique Roll No</span>
          </div>
        </section>

        {/* Right 8 Cols: Borrowers Directory Table */}
        <section
          aria-label="Borrowers Directory Table"
          className="lg:col-span-8 apple-glass-table p-6 sm:p-8 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/10">
            <div>
              <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#fbf8ee]">
                Registered Borrowers Table ({filteredBorrowers.length} records)
              </h2>
              <p className="text-xs text-[#b5b8ad] font-mono">
                SELECT borrower_id, borrower_name, roll_no FROM borrowers
              </p>
            </div>
            <div className="relative flex items-center">
              <span className="absolute left-3 text-[#b5b8ad] font-mono text-xs">&gt;_</span>
              <input
                type="search"
                aria-label="Search borrowers"
                placeholder="Search name or roll no..."
                value={borrowerSearch}
                onChange={(e) => setBorrowerSearch(e.target.value)}
                className="pl-8 pr-4 py-1.5 rounded-xl bg-white/05 border border-white/15 text-[#fbf8ee] font-mono text-xs placeholder-[#b5b8ad]/60 focus:outline-none focus:ring-2 focus:ring-[#ffd085]/50"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="text-[#b5b8ad] uppercase tracking-wider border-b border-white/10 font-semibold text-[11px]">
                  <th className="py-3 px-4">Borrower ID</th>
                  <th className="py-3 px-4">Borrower Name</th>
                  <th className="py-3 px-4">Roll No</th>
                  <th className="py-3 px-4 text-right">Total Borrowed</th>
                  <th className="py-3 px-4 text-right">Active Loans</th>
                  <th className="py-3 px-4 text-right">Overdue Loans</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/05">
                {filteredBorrowers.map((br) => (
                  <tr key={br.borrower_id} className="hover:bg-white/05 transition-colors">
                    <td className="py-3.5 px-4 text-[#ffd085] font-semibold">#{br.borrower_id}</td>
                    <td className="py-3.5 px-4 font-sans font-medium text-[#fbf8ee] text-sm">
                      {br.borrower_name}
                    </td>
                    <td className="py-3.5 px-4 text-sky-300">{br.roll_no}</td>
                    <td className="py-3.5 px-4 text-right text-[#fbf8ee] font-bold">
                      {br.total_borrowed ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-right text-emerald-400 font-semibold">
                      {br.active_loans ?? 0}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className={br.overdue_loans ? 'text-rose-400 font-bold' : 'text-white/30'}>
                        {br.overdue_loans ?? 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    );
  }

  // Default SubRoute: 'books' ('/catalog')
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left 4 Cols: Add Book Record */}
      <section
        aria-label="Add Book Record"
        className="lg:col-span-4 apple-glass glass-edge-sweep p-6 sm:p-7"
      >
        <div className="text-xs font-mono text-[#ffd085]">
          books(book_id, isbn, title, author, category, copies_available)
        </div>
        <h2 className="mt-1 font-serif text-2xl font-bold text-[#fbf8ee]">
          Add Book to Library Catalog
        </h2>
        <form onSubmit={handleCreateBook} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="book-isbn-input"
              className="block text-xs font-mono uppercase tracking-wider text-[#d8dad0] mb-1.5"
            >
              ISBN-13
            </label>
            <input
              id="book-isbn-input"
              type="text"
              placeholder="978-0134093413"
              value={isbn}
              onChange={(e) => setIsbn(e.target.value)}
              className="w-full px-3.5 py-2 text-sm font-mono bg-black/55 text-[#fbf8ee] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd085]/60"
            />
          </div>

          <div>
            <label
              htmlFor="book-title-input"
              className="block text-xs font-mono uppercase tracking-wider text-[#d8dad0] mb-1.5"
            >
              Book Title
            </label>
            <input
              id="book-title-input"
              type="text"
              placeholder="Designing Data-Intensive Applications"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-black/55 text-[#fbf8ee] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd085]/60"
            />
          </div>

          <div>
            <label
              htmlFor="book-author-input"
              className="block text-xs font-mono uppercase tracking-wider text-[#d8dad0] mb-1.5"
            >
              Author Name
            </label>
            <input
              id="book-author-input"
              type="text"
              placeholder="Martin Kleppmann"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-black/55 text-[#fbf8ee] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd085]/60"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="book-category-input"
                className="block text-xs font-mono uppercase tracking-wider text-[#d8dad0] mb-1.5"
              >
                Subject Category
              </label>
              <input
                id="book-category-input"
                type="text"
                placeholder="Data Science"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-black/55 text-[#fbf8ee] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd085]/60"
              />
            </div>
            <div>
              <label
                htmlFor="book-copies-input"
                className="block text-xs font-mono uppercase tracking-wider text-[#d8dad0] mb-1.5"
              >
                Copies Available
              </label>
              <input
                id="book-copies-input"
                type="number"
                min={0}
                max={100}
                value={copiesAvailable}
                onChange={(e) => setCopiesAvailable(Number(e.target.value))}
                className="w-full px-3.5 py-2 text-sm font-mono bg-black/55 text-[#fbf8ee] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd085]/60"
              />
            </div>
          </div>

          {bookMsg && (
            <div
              role="alert"
              className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 ${
                bookMsg.type === 'error'
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {bookMsg.type === 'error' ? 'warning' : 'check_circle'}
              </span>
              <span>{bookMsg.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isBusy}
            className="w-full py-3 px-4 rounded-xl bg-[#ffd085] hover:bg-[#ffe0a3] text-[#191c19] font-mono text-xs font-bold shadow-[0_8px_24px_rgba(255,208,133,0.28)] transition-all cursor-pointer disabled:opacity-50"
          >
            Save Book Record
          </button>
        </form>
      </section>

      {/* Right 8 Cols: Books Catalog Table */}
      <section
        aria-label="Books Catalog Table"
        className="lg:col-span-8 apple-glass-table p-6 sm:p-8 space-y-5"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <h2 className="font-serif text-xl sm:text-2xl font-bold text-[#fbf8ee]">
              Books Inventory Table ({filteredBooks.length} titles)
            </h2>
            <p className="text-xs text-[#b5b8ad] font-mono">
              SELECT book_id, isbn, title, author, category, copies_available FROM books
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Filter by book category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3.5 py-1.5 text-xs font-mono bg-black/55 text-[#fbf8ee] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd085]/50"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div className="relative flex items-center">
              <span className="absolute left-3 text-[#b5b8ad] font-mono text-xs">&gt;_</span>
              <input
                type="search"
                aria-label="Search books catalog"
                placeholder="Search ISBN, title, author..."
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                className="pl-8 pr-4 py-1.5 rounded-xl bg-white/05 border border-white/15 text-[#fbf8ee] font-mono text-xs placeholder-[#b5b8ad]/60 focus:outline-none focus:ring-2 focus:ring-[#ffd085]/50"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr className="text-[#b5b8ad] uppercase tracking-wider border-b border-white/10 font-semibold text-[11px]">
                <th className="py-3 px-4">ID</th>
                <th className="py-3 px-4">ISBN</th>
                <th className="py-3 px-4">Title &amp; Author</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-right">Total Loans</th>
                <th className="py-3 px-4 text-right">Active Out</th>
                <th className="py-3 px-4 text-right">Copies Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/05">
              {filteredBooks.map((b) => (
                <tr key={b.book_id} className="hover:bg-white/05 transition-colors">
                  <td className="py-3.5 px-4 text-[#ffd085] font-semibold">#{b.book_id}</td>
                  <td className="py-3.5 px-4 text-[#d8dad0]">{b.isbn}</td>
                  <td className="py-3.5 px-4">
                    <div className="font-sans font-semibold text-[#fbf8ee] text-sm">{b.title}</div>
                    <div className="text-[11px] text-[#b5b8ad]">{b.author}</div>
                  </td>
                  <td className="py-3.5 px-4 text-sky-300">{b.category}</td>
                  <td className="py-3.5 px-4 text-right text-emerald-400 font-bold">
                    {b.total_loans ?? 0}
                  </td>
                  <td className="py-3.5 px-4 text-right text-[#d8dad0]">{b.active_loans ?? 0}</td>
                  <td className="py-3.5 px-4 text-right font-bold">
                    <span className={b.copies_available === 0 ? 'text-rose-400' : 'text-[#ffd085]'}>
                      {b.copies_available}
                    </span>
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
