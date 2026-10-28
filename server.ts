import express from 'express';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PYTHON_ENGINE_PATH = path.join(__dirname, 'python', 'library_engine.py');

function invokePythonEngine(action: string, payload: Record<string, unknown> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'python3',
      [PYTHON_ENGINE_PATH, action],
      { maxBuffer: 10 * 1024 * 1024, timeout: 15000 },
      (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(stderr || error.message));
        }
        try {
          const parsed = JSON.parse(stdout);
          resolve(parsed);
        } catch (parseErr) {
          reject(new Error(`Failed to parse Python output: ${stdout.slice(0, 300)}`));
        }
      }
    );

    if (child.stdin) {
      child.stdin.write(JSON.stringify(payload));
      child.stdin.end();
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. Get complete Python-computed state, reports, and Matplotlib SVG charts
  app.get('/api/state', async (_req, res) => {
    try {
      const result = await invokePythonEngine('state');
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 2. Issue a book transaction via Python engine
  app.post('/api/loans/issue', async (req, res) => {
    try {
      const result = await invokePythonEngine('issue', req.body || {});
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 3. Return a book transaction via Python engine
  app.post('/api/loans/return', async (req, res) => {
    try {
      const result = await invokePythonEngine('return', req.body || {});
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 4. Add a new book record via Python engine
  app.post('/api/books', async (req, res) => {
    try {
      const result = await invokePythonEngine('add-book', req.body || {});
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 5. Add a new borrower record via Python engine
  app.post('/api/borrowers', async (req, res) => {
    try {
      const result = await invokePythonEngine('add-borrower', req.body || {});
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 6. Update configurable due date window & reference evaluation date
  app.post('/api/settings', async (req, res) => {
    try {
      const result = await invokePythonEngine('settings', req.body || {});
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 7. Run read-only SQL query against the Python SQLite/MySQL database
  app.post('/api/sql', async (req, res) => {
    try {
      const result = await invokePythonEngine('sql', req.body || {});
      res.status(result.ok ? 200 : 400).json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 8. Execute Python CLI statistical analysis report & return stdout
  app.post('/api/python/cli-report', async (_req, res) => {
    try {
      const result = await invokePythonEngine('cli-report');
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 9. Reset database to initial seed state
  app.post('/api/reset', async (_req, res) => {
    try {
      const result = await invokePythonEngine('reset');
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // 10. Get Python source files for student project submission inspection & download
  app.get('/api/python/files', (_req, res) => {
    try {
      const engineCode = fs.readFileSync(path.join(__dirname, 'python', 'library_engine.py'), 'utf-8');
      const pandasCode = fs.readFileSync(
        path.join(__dirname, 'python', 'submission', 'library_analysis_pandas_numpy.py'),
        'utf-8'
      );
      const mysqlCode = fs.readFileSync(
        path.join(__dirname, 'python', 'submission', 'schema_mysql.sql'),
        'utf-8'
      );
      const requirementsTxt = [
        'pandas>=2.1.0',
        'numpy>=1.26.0',
        'matplotlib>=3.8.0',
        'mysql-connector-python>=8.3.0',
      ].join('\n');

      res.json({
        ok: true,
        files: [
          {
            filename: 'library_engine.py',
            title: 'Primary Python Circulation & Analytics Engine (SQLite3 + Statistics + SVG Plots)',
            language: 'python',
            content: engineCode,
          },
          {
            filename: 'library_analysis_pandas_numpy.py',
            title: 'Pandas, NumPy & Matplotlib Standalone Data Analysis Script',
            language: 'python',
            content: pandasCode,
          },
          {
            filename: 'schema_mysql.sql',
            title: 'MySQL Relational Database Schema (books, borrowers, loans) & Queries',
            language: 'sql',
            content: mysqlCode,
          },
          {
            filename: 'requirements.txt',
            title: 'Python Package Dependencies',
            language: 'text',
            content: requirementsTxt,
          },
        ],
      });
    } catch (err: any) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, allowedHosts: true, host: '0.0.0.0' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PyLibAnalytics Server running on http://localhost:${PORT}`);
  });
}

startServer();
