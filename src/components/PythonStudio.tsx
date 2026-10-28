import React, { useState, useEffect } from 'react';
import { Play, Download, Copy, Check, Database, RotateCcw } from 'lucide-react';

interface PythonFileItem {
  filename: string;
  title: string;
  language: string;
  content: string;
}

interface PythonStudioProps {
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

  return (
    <div className="space-y-8">
      {/* Live Python 3 CLI Output Runner */}
      <section
        aria-label="Live Python 3 Execution Console"
        className="bg-[#13161B] border border-[#242933] rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#222731] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-xs font-mono text-[#D2FF00]">
              $ python3 python/library_engine.py
            </div>
            <h2 className="text-base font-bold text-[#F4F6F8]">
              Live Python 3 Statistical &amp; Circulation Report Runner
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onResetDatabase}
              disabled={isBusy}
              className="px-3 py-1.5 text-xs font-medium text-[#F4F6F8] bg-[#1C2129] hover:bg-[#262C36] border border-[#2D3440] rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Seed Database
            </button>
            <button
              type="button"
              onClick={handleExecuteCli}
              disabled={cliLoading || isBusy}
              className="px-3.5 py-1.5 text-xs font-bold text-[#0B0C0E] bg-[#D2FF00] hover:bg-[#b8e600] rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              {cliLoading ? 'Running Python...' : 'Run Python Analysis'}
            </button>
          </div>
        </div>

        <pre
          data-testid="python-cli-output"
          className="p-5 bg-[#0B0C0E] text-[#E2E8F0] font-mono text-xs leading-relaxed overflow-x-auto max-h-96"
        >
          {cliOutput || 'Executing Python 3 script...'}
        </pre>
      </section>

      {/* Interactive Relational SQL Query Console */}
      <section
        aria-label="Relational SQL Query Console"
        className="bg-[#13161B] border border-[#242933] rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#222731] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#F4F6F8]">
              Interactive SQL Query Workbench (books, borrowers, loans)
            </h2>
            <p className="text-xs text-[#8A94A6]">
              Execute live SQL queries via Python sqlite3 / MySQL schema
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {PRESET_QUERIES.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setSqlInput(preset.sql);
                  handleExecuteSql(preset.sql);
                }}
                className="px-2.5 py-1 text-xs font-medium text-[#F4F6F8] bg-[#1C2129] hover:bg-[#262C36] border border-[#2D3440] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <textarea
              aria-label="SQL Query Editor"
              rows={4}
              value={sqlInput}
              onChange={(e) => setSqlInput(e.target.value)}
              className="flex-1 p-3 font-mono text-xs bg-[#0B0C0E] text-[#F4F6F8] border border-[#2D3440] rounded-md focus:outline-none focus:ring-2 focus:ring-[#D2FF00]"
            />
            <button
              type="button"
              onClick={() => handleExecuteSql()}
              className="px-4 py-2 text-xs font-bold text-[#0B0C0E] bg-[#D2FF00] hover:bg-[#b8e600] rounded-md transition-colors self-start flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              Execute SQL
            </button>
          </div>

          {sqlResult?.error ? (
            <div className="p-3 bg-[#2A1218] border border-[#FF3B5C]/40 rounded-md text-xs text-[#FF6B84] font-mono">
              {sqlResult.error}
            </div>
          ) : sqlResult && sqlResult.columns.length > 0 ? (
            <div className="overflow-x-auto border border-[#222731] rounded-md">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#222731] bg-[#0E1116] text-xs font-mono font-semibold text-[#D2FF00]">
                    {sqlResult.columns.map((col) => (
                      <th key={col} className="py-2 px-3 whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222731] text-xs font-mono tabular-nums">
                  {sqlResult.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-[#191D24]">
                      {sqlResult.columns.map((col) => (
                        <td key={col} className="py-2 px-3 text-[#F4F6F8]">
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

      {/* Complete Python Submission Source Code Pack */}
      <section
        aria-label="Python Project Submission Files"
        className="bg-[#13161B] border border-[#242933] rounded-xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#222731] flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-[#F4F6F8]">
              Python Project Submission Source Files
            </h2>
            <p className="text-xs text-[#8A94A6]">
              Ready-to-submit Python 3 scripts (Pandas, NumPy, Matplotlib, SQLite/MySQL)
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {files.map((file, idx) => (
              <button
                key={file.filename}
                type="button"
                onClick={() => setActiveFileIdx(idx)}
                className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeFileIdx === idx
                    ? 'bg-[#D2FF00] text-[#0B0C0E] font-bold'
                    : 'bg-[#1C2129] text-[#94A3B8] hover:text-[#F4F6F8]'
                }`}
              >
                {file.filename}
              </button>
            ))}
          </div>
        </div>

        {activeFile && (
          <div>
            <div className="px-5 py-2.5 bg-[#0E1116] border-b border-[#222731] flex items-center justify-between gap-4">
              <span className="text-xs font-medium text-[#94A3B8]">{activeFile.title}</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyFileContent(activeFile)}
                  className="px-2.5 py-1 text-xs font-medium text-[#F4F6F8] bg-[#1C2129] border border-[#2D3440] hover:bg-[#262C36] rounded flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedFile === activeFile.filename ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#D2FF00]" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy Code
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => downloadFile(activeFile)}
                  className="px-2.5 py-1 text-xs font-bold text-[#0B0C0E] bg-[#D2FF00] hover:bg-[#b8e600] rounded flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download {activeFile.filename}
                </button>
              </div>
            </div>
            <pre className="p-5 bg-[#0B0C0E] text-[#E2E8F0] font-mono text-xs leading-relaxed overflow-x-auto max-h-[520px]">
              {activeFile.content}
            </pre>
          </div>
        )}
      </section>
    </div>
  );
};
