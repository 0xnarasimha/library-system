import React, { useState } from 'react';
import type { BookRecord, BorrowerRecord } from '../utils/circulationRules';
import { AlertCircle, CheckCircle2, Search } from 'lucide-react';

interface CatalogAndBorrowersProps {
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

  return (
    <div className="space-y-8">
      {/* Top Split: Add Book Record + Add Borrower Record */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Form 1: Add Book Record */}
        <section
          aria-label="Add Book Record"
          className="bg-[#13161B] border border-[#242933] rounded-xl p-6 flex flex-col justify-between"
        >
          <div>
            <div className="text-xs font-mono text-[#D2FF00]">
              books(book_id, isbn, title, author, category, copies_available)
            </div>
            <h2 className="mt-1 text-lg font-bold text-[#F4F6F8]">
              Add Book to Library Catalog
            </h2>
            <form onSubmit={handleCreateBook} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="book-isbn-input" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    ISBN-13
                  </label>
                  <input
                    id="book-isbn-input"
                    type="text"
                    placeholder="978-0134093413"
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm font-mono bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
                  />
                </div>
                <div>
                  <label htmlFor="book-category-input" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Subject Category
                  </label>
                  <input
                    id="book-category-input"
                    type="text"
                    placeholder="Data Science"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="book-title-input" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Book Title
                </label>
                <input
                  id="book-title-input"
                  type="text"
                  placeholder="Designing Data-Intensive Applications"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-1.5 text-sm bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor="book-author-input" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Author Name
                  </label>
                  <input
                    id="book-author-input"
                    type="text"
                    placeholder="Martin Kleppmann"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
                  />
                </div>
                <div>
                  <label htmlFor="book-copies-input" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                    Copies Available
                  </label>
                  <input
                    id="book-copies-input"
                    type="number"
                    min={0}
                    max={100}
                    value={copiesAvailable}
                    onChange={(e) => setCopiesAvailable(Number(e.target.value))}
                    className="w-full px-3 py-1.5 text-sm font-mono tabular-nums bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
                  />
                </div>
              </div>

              {bookMsg && (
                <div
                  role="alert"
                  className={`p-2.5 rounded-md border text-xs flex items-center gap-2 ${
                    bookMsg.type === 'error'
                      ? 'bg-[#2A1218] border-[#FF3B5C]/40 text-[#FF6B84]'
                      : 'bg-[#172308] border-[#D2FF00]/40 text-[#D2FF00]'
                  }`}
                >
                  {bookMsg.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-[#FF3B5C] shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[#D2FF00] shrink-0" />
                  )}
                  <span>{bookMsg.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isBusy}
                className="w-full py-2 px-4 text-xs font-bold text-[#0B0C0E] bg-[#D2FF00] hover:bg-[#b8e600] rounded-md transition-colors cursor-pointer disabled:opacity-50"
              >
                Save Book Record
              </button>
            </form>
          </div>
        </section>

        {/* Form 2: Add Borrower Record */}
        <section
          aria-label="Add Borrower Record"
          className="bg-[#13161B] border border-[#242933] rounded-xl p-6 flex flex-col justify-between"
        >
          <div>
            <div className="text-xs font-mono text-[#D2FF00]">
              borrowers(borrower_id, borrower_name, roll_no)
            </div>
            <h2 className="mt-1 text-lg font-bold text-[#F4F6F8]">
              Register Student / Faculty Borrower
            </h2>
            <p className="text-xs text-[#8A94A6] mt-1">
              Adds a borrower entity with unique university roll number for circulation tracking.
            </p>

            <form onSubmit={handleCreateBorrower} className="mt-5 space-y-4">
              <div>
                <label htmlFor="borrower-name-input" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  Full Name
                </label>
                <input
                  id="borrower-name-input"
                  type="text"
                  placeholder="Neha Kulkarni"
                  value={borrowerName}
                  onChange={(e) => setBorrowerName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
                />
              </div>

              <div>
                <label htmlFor="borrower-roll-input" className="block text-xs font-semibold text-[#94A3B8] mb-1">
                  University Roll Number (Unique)
                </label>
                <input
                  id="borrower-roll-input"
                  type="text"
                  placeholder="CS2024-089"
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
                />
              </div>

              {borrowerMsg && (
                <div
                  role="alert"
                  className={`p-2.5 rounded-md border text-xs flex items-center gap-2 ${
                    borrowerMsg.type === 'error'
                      ? 'bg-[#2A1218] border-[#FF3B5C]/40 text-[#FF6B84]'
                      : 'bg-[#172308] border-[#D2FF00]/40 text-[#D2FF00]'
                  }`}
                >
                  {borrowerMsg.type === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-[#FF3B5C] shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-[#D2FF00] shrink-0" />
                  )}
                  <span>{borrowerMsg.text}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isBusy}
                className="w-full py-2.5 px-4 text-xs font-bold text-[#0B0C0E] bg-[#F4F6F8] hover:bg-white rounded-md transition-colors cursor-pointer disabled:opacity-50"
              >
                Register Borrower
              </button>
            </form>
          </div>

          <div className="mt-6 pt-4 border-t border-[#222731] flex items-center justify-between text-xs text-[#8A94A6] font-mono">
            <span>Total Registered Borrowers: {borrowers.length}</span>
            <span>Unique Roll Numbers Enforced</span>
          </div>
        </section>
      </div>

      {/* Books Catalog Table */}
      <section aria-label="Books Catalog Table" className="bg-[#13161B] border border-[#242933] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#222731] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#F4F6F8]">
              Books Inventory Table ({filteredBooks.length} titles)
            </h2>
            <p className="text-xs text-[#8A94A6] font-mono">
              SELECT book_id, isbn, title, author, category, copies_available FROM books
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Filter by book category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8A94A6] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                aria-label="Search books catalog"
                placeholder="Search ISBN, title, author..."
                value={bookSearch}
                onChange={(e) => setBookSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#222731] bg-[#0E1116] text-xs font-semibold text-[#8A94A6]">
                <th className="py-2.5 px-4 whitespace-nowrap">ID</th>
                <th className="py-2.5 px-4 whitespace-nowrap">ISBN</th>
                <th className="py-2.5 px-4">Title &amp; Author</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Total Loans</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Active Out</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Copies Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222731] text-sm">
              {filteredBooks.map((b) => (
                <tr key={b.book_id} className="hover:bg-[#191D24]">
                  <td className="py-2.5 px-4 font-mono text-xs text-[#94A3B8] tabular-nums whitespace-nowrap">
                    #{b.book_id}
                  </td>
                  <td className="py-2.5 px-4 font-mono text-xs text-[#94A3B8] tabular-nums whitespace-nowrap">
                    {b.isbn}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-[#F4F6F8]">{b.title}</div>
                    <div className="text-xs text-[#8A94A6]">{b.author}</div>
                  </td>
                  <td className="py-2.5 px-4 text-xs text-[#94A3B8]">{b.category}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs font-semibold text-[#F4F6F8] tabular-nums whitespace-nowrap">
                    {b.total_loans ?? 0}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs text-[#94A3B8] tabular-nums whitespace-nowrap">
                    {b.active_loans ?? 0}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs font-semibold tabular-nums whitespace-nowrap">
                    <span className={b.copies_available === 0 ? 'text-amber-400' : 'text-[#D2FF00]'}>
                      {b.copies_available}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Borrowers Directory Table */}
      <section aria-label="Borrowers Directory Table" className="bg-[#13161B] border border-[#242933] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#222731]">
          <h2 className="text-base font-bold text-[#F4F6F8]">
            Registered Borrowers Table ({borrowers.length} records)
          </h2>
          <p className="text-xs text-[#8A94A6] font-mono">
            SELECT borrower_id, borrower_name, roll_no FROM borrowers
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#222731] bg-[#0E1116] text-xs font-semibold text-[#8A94A6]">
                <th className="py-2.5 px-4 whitespace-nowrap">Borrower ID</th>
                <th className="py-2.5 px-4">Borrower Name</th>
                <th className="py-2.5 px-4 whitespace-nowrap">Roll No</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Total Borrowed</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Active Loans</th>
                <th className="py-2.5 px-4 text-right whitespace-nowrap">Overdue Loans</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222731] text-sm">
              {borrowers.map((br) => (
                <tr key={br.borrower_id} className="hover:bg-[#191D24]">
                  <td className="py-2.5 px-4 font-mono text-xs text-[#94A3B8] tabular-nums whitespace-nowrap">
                    #{br.borrower_id}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-[#F4F6F8]">{br.borrower_name}</td>
                  <td className="py-2.5 px-4 font-mono text-xs text-[#94A3B8] whitespace-nowrap">{br.roll_no}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs text-[#F4F6F8] tabular-nums whitespace-nowrap">
                    {br.total_borrowed ?? 0}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs text-[#D2FF00] tabular-nums whitespace-nowrap">
                    {br.active_loans ?? 0}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono text-xs tabular-nums whitespace-nowrap">
                    <span className={br.overdue_loans ? 'text-[#FF3B5C] font-semibold' : 'text-[#475569]'}>
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
};
