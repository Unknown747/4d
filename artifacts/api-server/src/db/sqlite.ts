import Database from "better-sqlite3";
import path from "path";

const dbPath = path.resolve(process.cwd(), "result.db");

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hk4d_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draw_date TEXT NOT NULL UNIQUE,
      result_4d TEXT NOT NULL,
      result_3d TEXT NOT NULL,
      result_2d TEXT NOT NULL,
      source TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_hk4d_draw_date ON hk4d_results(draw_date DESC);

    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fetched_at TEXT DEFAULT (datetime('now')),
      added INTEGER DEFAULT 0,
      skipped INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ok',
      message TEXT
    );

    CREATE TABLE IF NOT EXISTS predictions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      angka TEXT NOT NULL,
      status TEXT DEFAULT 'SEDANG',
      score INTEGER DEFAULT 50,
      reason TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS rekomendasi_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_rekom_based_on ON rekomendasi_history(based_on_date DESC);
  `);

  const count = (db.prepare("SELECT COUNT(*) as c FROM hk4d_results").get() as { c: number }).c;
  if (count === 0) {
    seedData();
  }
}

export function derive4d(r4d: string): { r3d: string; r2d: string } {
  const s = r4d.padStart(4, "0");
  return { r3d: s.slice(1), r2d: s.slice(2) };
}

function seedData() {
  const draws: { date: string; result: string }[] = [
    { date: "2026-06-16", result: "1064" },
    { date: "2026-06-15", result: "9907" },
    { date: "2026-06-14", result: "0365" },
    { date: "2026-06-13", result: "3372" },
    { date: "2026-06-12", result: "9815" },
    { date: "2026-06-11", result: "6253" },
    { date: "2026-06-10", result: "5537" },
    { date: "2026-06-09", result: "1521" },
    { date: "2026-06-08", result: "0933" },
    { date: "2026-06-07", result: "1893" },
    { date: "2026-06-06", result: "7021" },
    { date: "2026-06-05", result: "0827" },
    { date: "2026-06-04", result: "9114" },
    { date: "2026-06-03", result: "1093" },
    { date: "2026-06-02", result: "5802" },
    { date: "2026-06-01", result: "0735" },
    { date: "2026-05-31", result: "6516" },
    { date: "2026-05-30", result: "0091" },
    { date: "2026-05-29", result: "6327" },
    { date: "2026-05-28", result: "3268" },
    { date: "2026-05-27", result: "1679" },
    { date: "2026-05-26", result: "9138" },
    { date: "2026-05-25", result: "5909" },
    { date: "2026-05-24", result: "3754" },
    { date: "2026-05-23", result: "6284" },
    { date: "2026-05-22", result: "5767" },
    { date: "2026-05-21", result: "4915" },
    { date: "2026-05-20", result: "6881" },
  ];

  const insert = db.prepare(
    `INSERT OR IGNORE INTO hk4d_results (draw_date, result_4d, result_3d, result_2d, source)
     VALUES (?, ?, ?, ?, 'seed')`
  );
  const insertMany = db.transaction(() => {
    for (const d of draws) {
      const { r3d, r2d } = derive4d(d.result);
      insert.run(d.date, d.result.padStart(4, "0"), r3d, r2d);
    }
  });
  insertMany();
}
