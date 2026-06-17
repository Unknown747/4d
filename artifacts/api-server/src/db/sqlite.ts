import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve(process.cwd(), "result.db");

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDb() {
  // Create tables if they don't exist yet.
  // Indexes on `market` are deferred to runMigrations() because on an existing
  // (pre-market) DB those columns don't exist until migration adds them.
  db.exec(`
    CREATE TABLE IF NOT EXISTS hk4d_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market TEXT NOT NULL DEFAULT 'sgp',
      draw_date TEXT NOT NULL,
      result_4d TEXT NOT NULL,
      result_3d TEXT NOT NULL,
      result_2d TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(market, draw_date)
    );

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market TEXT DEFAULT 'sgp',
      fetched_at TEXT DEFAULT (datetime('now')),
      added INTEGER DEFAULT 0,
      skipped INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ok',
      message TEXT
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market TEXT NOT NULL DEFAULT 'sgp',
      date TEXT NOT NULL,
      pred_type TEXT NOT NULL,
      angka TEXT NOT NULL,
      method TEXT DEFAULT 'statistik',
      score INTEGER DEFAULT 50,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS validations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market TEXT NOT NULL DEFAULT 'sgp',
      angka TEXT NOT NULL,
      status TEXT DEFAULT 'SEDANG',
      score INTEGER DEFAULT 50,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rekomendasi_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      market TEXT NOT NULL DEFAULT 'sgp',
      based_on_date TEXT NOT NULL,
      angka_kuat TEXT NOT NULL,
      predictions_json TEXT NOT NULL,
      confidence INTEGER DEFAULT 0,
      actual_4d TEXT,
      actual_3d TEXT,
      actual_2d TEXT,
      hit_4d INTEGER DEFAULT 0,
      hit_3d INTEGER DEFAULT 0,
      hit_2d INTEGER DEFAULT 0,
      checked_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(market, based_on_date)
    );
  `);

  runMigrations();
}

function runMigrations() {
  // ── hk4d_results ─────────────────────────────────────────────────────────
  // If the table was created without a `market` column (legacy HK schema),
  // recreate it. Old HK data is intentionally not migrated since this is a
  // full rebrand to SGP/SDY and historical HK draws are irrelevant.
  const hk4dCols = db.prepare(`PRAGMA table_info(hk4d_results)`).all() as { name: string }[];
  if (!hk4dCols.some(c => c.name === 'market') && hk4dCols.length > 0) {
    try {
      db.exec(`ALTER TABLE hk4d_results RENAME TO _hk4d_legacy`);
      db.exec(`
        CREATE TABLE hk4d_results (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          market TEXT NOT NULL DEFAULT 'sgp',
          draw_date TEXT NOT NULL,
          result_4d TEXT NOT NULL,
          result_3d TEXT NOT NULL,
          result_2d TEXT NOT NULL,
          source TEXT DEFAULT 'manual',
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(market, draw_date)
        );
        DROP TABLE IF EXISTS _hk4d_legacy;
      `);
    } catch { /* already done */ }
  }

  // ── rekomendasi_history ───────────────────────────────────────────────────
  // Drop legacy table (no market column) so CREATE TABLE IF NOT EXISTS re-creates it.
  const rekCols = db.prepare(`PRAGMA table_info(rekomendasi_history)`).all() as { name: string }[];
  if (!rekCols.some(c => c.name === 'market') && rekCols.length > 0) {
    try { db.exec(`DROP TABLE IF EXISTS rekomendasi_history`); } catch {}
    db.exec(`
      CREATE TABLE IF NOT EXISTS rekomendasi_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        market TEXT NOT NULL DEFAULT 'sgp',
        based_on_date TEXT NOT NULL,
        angka_kuat TEXT NOT NULL,
        predictions_json TEXT NOT NULL,
        confidence INTEGER DEFAULT 0,
        actual_4d TEXT,
        actual_3d TEXT,
        actual_2d TEXT,
        hit_4d INTEGER DEFAULT 0,
        hit_3d INTEGER DEFAULT 0,
        hit_2d INTEGER DEFAULT 0,
        checked_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(market, based_on_date)
      );
    `);
  }

  // ── Additive column migrations for other tables ───────────────────────────
  try { db.exec(`ALTER TABLE sync_log ADD COLUMN market TEXT DEFAULT 'sgp'`); } catch {}
  try { db.exec(`ALTER TABLE predictions ADD COLUMN market TEXT NOT NULL DEFAULT 'sgp'`); } catch {}
  try { db.exec(`ALTER TABLE validations ADD COLUMN market TEXT NOT NULL DEFAULT 'sgp'`); } catch {}

  // ── Indexes on market (safe to create after migration) ────────────────────
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_hk4d_market_date ON hk4d_results(market, draw_date DESC)`); } catch {}
  try { db.exec(`CREATE INDEX IF NOT EXISTS idx_rekom_market_date ON rekomendasi_history(market, based_on_date DESC)`); } catch {}
}

export function derive4d(r4d: string): { r3d: string; r2d: string } {
  const s = r4d.padStart(4, "0");
  return { r3d: s.slice(1), r2d: s.slice(2) };
}
