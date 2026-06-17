import { db, derive4d } from "../db/sqlite.js";
import { logger } from "./logger.js";

export interface SyncResult {
  market: string;
  added: number;
  skipped: number;
  errors: string[];
  fetchedAt: string;
}

export type Market = "sgp" | "sdy";

// SGP draws: Sun(0), Mon(1), Wed(3), Thu(4), Sat(6)
const SGP_DRAW_DAYS = new Set([0, 1, 3, 4, 6]);

function isSGPDay(date: Date): boolean {
  return SGP_DRAW_DAYS.has(date.getDay());
}

function dateToStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ── Fetch a single result from external sources ────────────────────────────
// Tries multiple URL patterns; extracts first 4-digit number from JSON response.
// Override per-market via env vars LOTTERY_API_URL_SGP / LOTTERY_API_URL_SDY
async function fetchResultFromSources(market: Market, date: string): Promise<string | null> {
  const envUrl = market === "sgp"
    ? process.env["LOTTERY_API_URL_SGP"]
    : process.env["LOTTERY_API_URL_SDY"];

  // Build candidate URLs (try env override first)
  const urls: string[] = [];
  if (envUrl) urls.push(`${envUrl}/${date}`);

  urls.push(
    `https://live4dtoday.net/api/result/${market}?date=${date}`,
    `https://data.togel4d.wiki/api/${market}/${date}`,
    `https://api.lottoresult.xyz/${market}?date=${date}`,
    `https://result4d.live/api/${market}/${date}`,
  );

  for (const url of urls) {
    try {
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(8_000),
        headers: { Accept: "application/json, text/plain, */*", "User-Agent": "TotoPro/1.0" },
      });
      if (!resp.ok) continue;

      const text = await resp.text();
      // Extract first standalone 4-digit number from response
      const m = text.match(/\b(\d{4})\b/);
      if (m && m[1]) {
        logger.info({ market, date, result: m[1], url }, "Sync: fetched result");
        return m[1];
      }
    } catch (err) {
      logger.debug({ url, err: String(err) }, "Sync: source failed, trying next");
    }
  }

  logger.warn({ market, date }, "Sync: all sources failed for date");
  return null;
}

// ── Calculate which dates are missing in DB for a given market ──────────────
function getMissingDates(market: Market): string[] {
  const lastRow = db
    .prepare(`SELECT draw_date FROM hk4d_results WHERE market=? ORDER BY draw_date DESC LIMIT 1`)
    .get(market) as { draw_date: string } | undefined;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Start from day after last known, or 30 days ago if no data at all
  const fromDate = lastRow
    ? addDays(new Date(lastRow.draw_date), 1)
    : addDays(today, -30);

  const dates: string[] = [];
  let cur = new Date(fromDate);
  cur.setHours(0, 0, 0, 0);

  while (cur <= today) {
    if (market === "sgp" && !isSGPDay(cur)) {
      cur = addDays(cur, 1);
      continue;
    }
    dates.push(dateToStr(cur));
    cur = addDays(cur, 1);
  }

  return dates;
}

// ── Sync a single market (catches up all missing dates) ──────────────────────
export async function syncMarket(market: Market): Promise<SyncResult> {
  const result: SyncResult = {
    market,
    added: 0,
    skipped: 0,
    errors: [],
    fetchedAt: new Date().toISOString(),
  };

  const missingDates = getMissingDates(market);

  if (missingDates.length === 0) {
    logger.info({ market }, "Sync: already up to date");
    logSync(market, 0, 0, "ok", "Up to date");
    return result;
  }

  logger.info({ market, count: missingDates.length, dates: missingDates.slice(0, 5) }, "Sync: fetching missing draws");

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO hk4d_results (market, draw_date, result_4d, result_3d, result_2d, source)
     VALUES (?, ?, ?, ?, ?, 'auto')`
  );

  for (const date of missingDates) {
    const r4d = await fetchResultFromSources(market, date);
    if (!r4d) {
      result.skipped++;
      result.errors.push(`${date}: no data from sources`);
      continue;
    }
    try {
      const padded = r4d.padStart(4, "0");
      const { r3d, r2d } = derive4d(padded);
      const info = stmt.run(market, date, padded, r3d, r2d);
      if (info.changes > 0) {
        result.added++;
      } else {
        result.skipped++;
      }
    } catch (err) {
      result.skipped++;
      result.errors.push(`${date}: ${String(err)}`);
    }
  }

  const status = result.added > 0 ? "ok" : result.errors.length > 0 ? "error" : "ok";
  logSync(
    market,
    result.added,
    result.skipped,
    status,
    result.errors.length > 0 ? result.errors.slice(0, 3).join("; ") : undefined
  );

  logger.info({ market, added: result.added, skipped: result.skipped }, "Sync: complete");
  return result;
}

// ── Sync both SGP and SDY ────────────────────────────────────────────────────
export async function syncAll(): Promise<{ sgp: SyncResult; sdy: SyncResult }> {
  const [sgp, sdy] = await Promise.all([syncMarket("sgp"), syncMarket("sdy")]);
  return { sgp, sdy };
}

// ── Get sync status for the status endpoint ──────────────────────────────────
export function getSyncStatus(market?: string) {
  type LogRow = { market: string; fetched_at: string; added: number; skipped: number; status: string; message: string | null };

  const lastSGP = db
    .prepare(`SELECT * FROM sync_log WHERE market='sgp' ORDER BY id DESC LIMIT 1`)
    .get() as LogRow | undefined;
  const lastSDY = db
    .prepare(`SELECT * FROM sync_log WHERE market='sdy' ORDER BY id DESC LIMIT 1`)
    .get() as LogRow | undefined;

  const countSGP = (db.prepare(`SELECT COUNT(*) as c FROM hk4d_results WHERE market='sgp'`).get() as { c: number }).c;
  const countSDY = (db.prepare(`SELECT COUNT(*) as c FROM hk4d_results WHERE market='sdy'`).get() as { c: number }).c;
  const lateSGP  = db.prepare(`SELECT draw_date FROM hk4d_results WHERE market='sgp' ORDER BY draw_date DESC LIMIT 1`).get() as { draw_date: string } | undefined;
  const lateSDY  = db.prepare(`SELECT draw_date FROM hk4d_results WHERE market='sdy' ORDER BY draw_date DESC LIMIT 1`).get() as { draw_date: string } | undefined;

  const all = market
    ? { [market]: market === "sgp" ? lastSGP : lastSDY }
    : { sgp: lastSGP, sdy: lastSDY };

  return {
    lastSync: all,
    sgp: { total: countSGP, lastDate: lateSGP?.draw_date ?? null },
    sdy: { total: countSDY, lastDate: lateSDY?.draw_date ?? null },
    missingDates: {
      sgp: getMissingDates("sgp").length,
      sdy: getMissingDates("sdy").length,
    },
  };
}

// ── Compatibility shim ───────────────────────────────────────────────────────
export function initSyncLog() {
  // sync_log table is already created in initDb() — nothing extra needed
}

// ── Internal helper ──────────────────────────────────────────────────────────
function logSync(market: string, added: number, skipped: number, status: string, message?: string) {
  try {
    db.prepare(
      `INSERT INTO sync_log (market, added, skipped, status, message) VALUES (?, ?, ?, ?, ?)`
    ).run(market, added, skipped, status, message ?? null);
  } catch { /* ignore log failures */ }
}
