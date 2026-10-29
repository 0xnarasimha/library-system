import React, { useState, useEffect } from 'react';
import type { AppRoutePath } from '../App';

export type PythonSubRoute = 'cli' | 'sql' | 'source' | 'presentation';

interface PythonFileItem {
  filename: string;
  title: string;
  language: string;
  content: string;
}

interface PythonStudioProps {
  subRoute: PythonSubRoute;
  onNavigateRoute: (path: AppRoutePath) => void;
  onRunCliReport: () => Promise<{ ok: boolean; report_text?: string; error?: string }>;
  onRunSql: (sql: string) => Promise<{
    ok: boolean;
    columns?: string[];
    rows?: Record<string, any>[];
    error?: string;
  }>;
  onResetDatabase: () => Promise<void>;
  isBusy: boolean;
}

const PRESET_QUERIES = [
  {
    label: 'Most-Borrowed Books Query',
    sql: `SELECT b.book_id, b.isbn, b.title, b.category, b.copies_available,
       COUNT(l.loan_id) AS total_loans,
       SUM(CASE WHEN l.return_date IS NULL THEN 1 ELSE 0 END) AS active_loans
FROM books b
LEFT JOIN loans l ON b.book_id = l.book_id
GROUP BY b.book_id, b.isbn, b.title, b.category, b.copies_available
ORDER BY total_loans DESC, active_loans DESC;`,
  },
  {
    label: 'Overdue Loans Query',
    sql: `SELECT l.loan_id, b.title AS book_title, br.borrower_name, br.roll_no,
       l.issue_date, l.due_date,
       CAST(julianday('2026-10-28') - julianday(l.due_date) AS INTEGER) AS days_overdue
FROM loans l
JOIN books b ON l.book_id = b.book_id
JOIN borrowers br ON l.borrower_id = br.borrower_id
WHERE l.return_date IS NULL AND l.due_date < '2026-10-28'
ORDER BY days_overdue DESC;`,
  },
  {
    label: 'Category Circulation Summary',
    sql: `SELECT b.category,
       COUNT(DISTINCT b.book_id) AS titles,
       SUM(b.copies_available) AS shelf_copies,
       COUNT(l.loan_id) AS total_loans
FROM books b
LEFT JOIN loans l ON b.book_id = l.book_id
GROUP BY b.category
ORDER BY total_loans DESC;`,
  },
  {
    label: 'Monthly Borrowing Trends',
    sql: `SELECT substr(issue_date, 1, 7) AS issue_month,
       COUNT(*) AS total_issued,
       SUM(CASE WHEN return_date IS NOT NULL THEN 1 ELSE 0 END) AS returned_count,
       COUNT(DISTINCT borrower_id) AS unique_borrowers
FROM loans
GROUP BY issue_month
ORDER BY issue_month ASC;`,
  },
];

export const PythonStudio: React.FC<PythonStudioProps> = ({
  subRoute,
  onRunCliReport,
  onRunSql,
  onResetDatabase,
  isBusy,
}) => {
  const [cliOutput, setCliOutput] = useState<string>('');
  const [cliLoading, setCliLoading] = useState<boolean>(false);

  const [sqlInput, setSqlInput] = useState<string>(PRESET_QUERIES[0].sql);
  const [sqlResult, setSqlResult] = useState<{
    columns: string[];
    rows: Record<string, any>[];
    error?: string;
  } | null>(null);

  const [files, setFiles] = useState<PythonFileItem[]>([]);
  const [activeFileIdx, setActiveFileIdx] = useState<number>(0);
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/python/files')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && Array.isArray(data.files)) {
          setFiles(data.files);
        }
      })
      .catch(() => {});

    handleExecuteCli();
    handleExecuteSql(PRESET_QUERIES[0].sql);
  }, []);

  const handleExecuteCli = async () => {
    setCliLoading(true);
    const res = await onRunCliReport();
    setCliLoading(false);
    if (res.ok && res.report_text) {
      setCliOutput(res.report_text);
    } else {
      setCliOutput(res.error || 'Error executing Python analysis script.');
    }
  };

  const handleExecuteSql = async (queryToRun?: string) => {
    const q = queryToRun ?? sqlInput;
    const res = await onRunSql(q);
    if (res.ok) {
      setSqlResult({ columns: res.columns || [], rows: res.rows || [] });
    } else {
      setSqlResult({ columns: [], rows: [], error: res.error || 'SQL query error' });
    }
  };

  const downloadFile = (file: PythonFileItem) => {
    const blob = new Blob([file.content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyFileContent = (file: PythonFileItem) => {
    navigator.clipboard?.writeText(file.content);
    setCopiedFile(file.filename);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const activeFile = files[activeFileIdx];

  if (subRoute === 'presentation') {
    return (
      <section
        aria-label="Project Presentation Slide Deck"
        className="apple-glass-table p-6 sm:p-8 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="text-xs font-mono text-[#ffd085]">
              ROUTE // /python/presentation · Interactive 9-Slide Presentation Deck
            </div>
            <h1 className="mt-1 font-serif text-2xl font-bold text-[#fbf8ee]">
              PyLibAnalytics — Project Presentation Deck
            </h1>
            <p className="text-xs text-[#b5b8ad]">
              Use arrow keys or bottom slide controls to navigate the 9 project slides
            </p>
          </div>
          <a
            href="/assets/aistudio/presentation_90e1e161.html"
            download="PyLibAnalytics_Presentation.html"
            className="px-4 py-2 rounded-xl bg-[#ffd085] hover:bg-[#ffe0a3] text-[#191c19] font-mono text-xs font-bold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">download</span>
            Download Presentation HTML
          </a>
        </div>
        <div className="w-full h-[640px] rounded-2xl overflow-hidden border border-white/15 bg-black/60">
          <iframe
            src="/assets/aistudio/presentation_90e1e161.html"
            title="PyLibAnalytics Project Presentation"
            className="w-full h-full border-0"
          />
        </div>
      </section>
    );
  }

  if (subRoute === 'sql') {
    return (
      <section
        aria-label="Relational SQL Query Console"
        className="apple-glass-table p-6 sm:p-8 space-y-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="text-xs font-mono text-[#ffd085]">
              ROUTE // /python/sql · sqlite3 &amp; MySQL Compatible
            </div>
            <h1 className="mt-1 font-serif text-2xl font-bold text-[#fbf8ee]">
              Interactive SQL Query Workbench (books, borrowers, loans)
            </h1>
            <p className="text-xs text-[#b5b8ad]">
              Execute live relational SQL queries via Python sqlite3 / MySQL schema
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_QUERIES.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setSqlInput(preset.sql);
                  handleExecuteSql(preset.sql);
                }}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-[#ffd085] hover:text-[#191c19] border border-white/15 text-xs font-mono text-[#fbf8ee] transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <textarea
              aria-label="SQL Query Editor"
              rows={5}
              value={sqlInput}
              onChange={(e) => setSqlInput(e.target.value)}
              className="flex-1 p-4 font-mono text-xs bg-black/55 text-[#fbf8ee] border border-white/15 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#ffd085]/60"
            />
            <button
              type="button"
              onClick={() => handleExecuteSql()}
              className="px-5 py-3 rounded-xl bg-[#ffd085] hover:bg-[#ffe0a3] text-[#191c19] font-mono text-xs font-bold transition-colors self-start flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">database</span>
              Execute SQL
            </button>
          </div>

          {sqlResult?.error ? (
            <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-xs text-rose-300 font-mono">
              {sqlResult.error}
            </div>
          ) : sqlResult && sqlResult.columns.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-white/15 bg-black/40">
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/05 text-[#ffd085] font-semibold">
                    {sqlResult.columns.map((col) => (
                      <th key={col} className="py-3 px-4 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/05">
                  {sqlResult.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-white/05">
                      {sqlResult.columns.map((col) => (
                        <td key={col} className="py-2.5 px-4 text-[#fbf8ee]">
                          {row[col] === null ? 'NULL' : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (subRoute === 'source') {
    return (
      <section
        aria-label="Python Project Submission Files"
        className="apple-glass-table p-6 sm:p-8 space-y-5"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="text-xs font-mono text-[#ffd085]">
              ROUTE // /python/source · Python 3 Project Submission Bundle
            </div>
            <h1 className="mt-1 font-serif text-2xl font-bold text-[#fbf8ee]">
              Python Project Submission Source Files
            </h1>
            <p className="text-xs text-[#b5b8ad]">
              Ready-to-submit Python 3 scripts (Pandas, NumPy, Matplotlib, SQLite/MySQL)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {files.map((file, idx) => (
              <button
                key={file.filename}
                type="button"
                onClick={() => setActiveFileIdx(idx)}
                className={`px-3.5 py-1.5 text-xs font-mono rounded-xl transition-colors cursor-pointer ${
                  activeFileIdx === idx
                    ? 'bg-[#ffd085] text-[#191c19] font-bold'
                    : 'bg-white/10 text-[#d8dad0] hover:text-[#fbf8ee]'
                }`}
              >
                {file.filename}
              </button>
            ))}
          </div>
        </div>

        {activeFile && (
          <div className="rounded-2xl overflow-hidden border border-white/15 bg-black/55">
            <div className="px-5 py-3 bg-white/05 border-b border-white/10 flex items-center justify-between gap-4">
              <span className="text-xs font-mono text-[#d8dad0]">{activeFile.title}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyFileContent(activeFile)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-mono text-[#fbf8ee] transition-colors cursor-pointer"
                >
                  {copiedFile === activeFile.filename ? 'Copied!' : 'Copy Code'}
                </button>
                <button
                  type="button"
                  onClick={() => downloadFile(activeFile)}
                  className="px-3 py-1.5 rounded-lg bg-[#ffd085] text-[#191c19] text-xs font-mono font-bold cursor-pointer"
                >
                  Download {activeFile.filename}
                </button>
              </div>
            </div>
            <pre className="p-5 text-[#fbf8ee] font-mono text-xs leading-relaxed overflow-x-auto max-h-[560px]">
              {activeFile.content}
            </pre>
          </div>
        )}
      </section>
    );
  }

  // Default SubRoute: 'cli' ('/python')
  return (
    <section
      aria-label="Live Python 3 Execution Console"
      className="apple-glass-table p-6 sm:p-8 space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/10">
        <div>
          <div className="text-xs font-mono text-[#ffd085]">
            ROUTE // /python · $ python3 python/library_engine.py
          </div>
          <h1 className="mt-1 font-serif text-2xl font-bold text-[#fbf8ee]">
            Live Python 3 Statistical &amp; Circulation Report Runner
          </h1>
          <p className="text-xs text-[#b5b8ad]">
            Executes the Python 3 backend script directly and streams formatted standard output
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onResetDatabase}
            disabled={isBusy}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-mono text-[#fbf8ee] transition-colors cursor-pointer"
          >
            Reset Seed Database
          </button>
          <button
            type="button"
            onClick={handleExecuteCli}
            disabled={cliLoading || isBusy}
            className="px-4 py-2 rounded-xl bg-[#ffd085] hover:bg-[#ffe0a3] text-[#191c19] font-mono text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">play_arrow</span>
            {cliLoading ? 'Running Python...' : 'Run Python Analysis'}
          </button>
        </div>
      </div>

      <pre
        data-testid="python-cli-output"
        className="p-6 rounded-2xl bg-black/60 border border-white/10 text-[#fbf8ee] font-mono text-xs leading-relaxed overflow-x-auto max-h-[540px]"
      >
        {cliOutput || 'Executing Python 3 script...'}
      </pre>
    </section>
  );
};
