import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbPath = path.resolve(process.cwd(), "result.db");

export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draw_date TEXT NOT NULL,
      period TEXT,
      n1 INTEGER NOT NULL,
      n2 INTEGER NOT NULL,
      n3 INTEGER NOT NULL,
      n4 INTEGER NOT NULL,
      n5 INTEGER NOT NULL,
      n6 INTEGER NOT NULL,
      extra INTEGER,
      source TEXT DEFAULT 'manual',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_results_draw_date ON results(draw_date DESC);
  `);

  const count = (db.prepare("SELECT COUNT(*) as c FROM results").get() as { c: number }).c;
  if (count === 0) {
    seedData();
  }
}

function seedData() {
  const draws = generateHistoricalDraws();
  const insert = db.prepare(
    `INSERT INTO results (draw_date, period, n1, n2, n3, n4, n5, n6, extra, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'seed')`
  );
  const insertMany = db.transaction((rows: typeof draws) => {
    for (const r of rows) {
      insert.run(r.date, r.period, ...r.nums, r.extra);
    }
  });
  insertMany(draws);
}

function pickUnique(count: number, max: number): number[] {
  const pool = Array.from({ length: max }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

function generateHistoricalDraws() {
  const draws: { date: string; period: string; nums: number[]; extra: number }[] = [];
  const base = new Date("2024-01-02");
  let drawNum = 24001;

  for (let i = 0; i < 120; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i * 3);
    const dateStr = d.toISOString().split("T")[0]!;
    const all = pickUnique(7, 49);
    draws.push({
      date: dateStr,
      period: String(drawNum + i),
      nums: all.slice(0, 6),
      extra: all[6]!,
    });
  }
  return draws.reverse();
}
