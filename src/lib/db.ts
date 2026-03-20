import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

function resolveDbPath() {
  const configuredPath = process.env.DATABASE_PATH?.trim();
  if (!configuredPath) {
    return path.join(process.cwd(), 'data', 'upg.db');
  }

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
}

const DB_PATH = resolveDbPath();

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function ensureColumn(
  db: Database.Database,
  tableName: string,
  columnName: string,
  definition: string,
) {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`);
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS prompt_sets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      system_prompt TEXT DEFAULT '',
      user_prompt TEXT DEFAULT '',
      response_format TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS test_runs (
      id TEXT PRIMARY KEY,
      batch_id TEXT,
      batch_label TEXT,
      prompt_set_id TEXT REFERENCES prompt_sets(id),
      prompt_label TEXT,
      prompt_source TEXT,
      prompt_order INTEGER DEFAULT 0,
      system_prompt TEXT,
      user_prompt TEXT,
      response_format TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      memo TEXT
    );

    CREATE TABLE IF NOT EXISTS test_results (
      id TEXT PRIMARY KEY,
      run_id TEXT REFERENCES test_runs(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      parameters TEXT,
      response TEXT,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0,
      latency_ms INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_test_results_run_id ON test_results(run_id);
    CREATE INDEX IF NOT EXISTS idx_test_runs_created_at ON test_runs(created_at);
    CREATE INDEX IF NOT EXISTS idx_test_runs_batch_id ON test_runs(batch_id);
  `);

  ensureColumn(db, 'test_runs', 'batch_id', 'TEXT');
  ensureColumn(db, 'test_runs', 'batch_label', 'TEXT');
  ensureColumn(db, 'test_runs', 'prompt_label', 'TEXT');
  ensureColumn(db, 'test_runs', 'prompt_source', 'TEXT');
  ensureColumn(db, 'test_runs', 'prompt_order', 'INTEGER DEFAULT 0');

  db.exec('CREATE INDEX IF NOT EXISTS idx_test_runs_batch_id ON test_runs(batch_id)');
}
