import { db, derive4d } from "../db/sqlite.js";
import { logger } from "./logger.js";

export interface SyncResult {
  added: number;
  skipped: number;
  errors: string[];
  fetchedAt: string;
}

export function initSyncLog() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fetched_at TEXT DEFAULT (datetime('now')),
      added INTEGER DEFAULT 0,
      skipped INTEGER DEFAULT 0,
      status TEXT DEFAULT 'ok',
      message TEXT
    )
  `);
}

function logSync(added: number, skipped: number, status: string, message?: string) {
  db.prepare(
    `INSERT INTO sync_log (added, skipped, status, message) VALUES (?, ?, ?, ?)`
  ).run(added, skipped, status, message ?? null);
}

export function getSyncStatus() {
  initSyncLog();
  const last = db
    .prepare("SELECT * FROM sync_log ORDER BY id DESC LIMIT 1")
    .get() as { fetched_at: string; added: number; skipped: number; status: string; message: string | null } | undefined;
  const total = (db.prepare("SELECT COUNT(*) as c FROM hk4d_results WHERE source='auto'").get() as { c: number }).c;
  return { last, totalAutoRecords: total };
}

// ─── Main sync function ───────────────────────────────────────────────────────
// Currently performs manual update only — auto-fetch from source not available.

export async function syncResults(): Promise<SyncResult> {
  initSyncLog();
  const result: SyncResult = {
    added: 0,
    skipped: 0,
    errors: [],
    fetchedAt: new Date().toISOString(),
  };

  logger.info("Sync requested — no remote source configured for HK 4D");
  result.errors.push("Auto-sync belum dikonfigurasi. Gunakan Input Result untuk menambah data baru.");
  logSync(0, 0, "error", "No remote source configured");

  return result;
}
