import { db } from "../db/sqlite.js";
import { logger } from "./logger.js";

export interface SyncResult {
  added: number;
  skipped: number;
  errors: string[];
  lastDrawDate: string | null;
  fetchedAt: string;
}

interface HKJCDraw {
  id: string;
  date: string;
  numbers: number[];
  extra: number | null;
}

async function fetchHKJCPage(pageNum: number): Promise<HKJCDraw[]> {
  const url = `https://bet.hkjc.com/marksix/getHistoryData.aspx?lang=en&page=${pageNum}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; HKTotoPro/1.0)",
      Accept: "text/html,application/xhtml+xml",
      Referer: "https://bet.hkjc.com/marksix/",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} from HKJC`);
  const html = await res.text();
  return parseHKJCHtml(html);
}

function parseHKJCHtml(html: string): HKJCDraw[] {
  const draws: HKJCDraw[] = [];

  // Match rows from HKJC result table
  // Pattern: draw no, date, 6 numbers + extra
  const rowRe =
    /<tr[^>]*>[\s\S]*?<td[^>]*>(\d{2}\/\d{2}\/\d{4})<\/td>[\s\S]*?<\/tr>/gi;
  const numRe = /<\/?(span|td|div)[^>]*>\s*(\d{1,2})\s*<\/\1>/gi;
  const drawNoRe = /Draw\s+No[.\s]*:?\s*(\d+)/i;
  const periodRe = /<td[^>]*>(\d{4}\/\d{2,4})<\/td>/gi;

  let match: RegExpExecArray | null;
  let periodMatch: RegExpExecArray | null;
  const periods: string[] = [];
  while ((periodMatch = periodRe.exec(html)) !== null) {
    periods.push(periodMatch[1]!);
  }

  // Alternative approach: parse structured JSON if embedded
  const jsonRe = /\[\s*\{[^}]*"drawno"[^}]*\}/i;
  if (jsonRe.test(html)) {
    try {
      const jsonStr = html.match(/(\[[\s\S]*\])/)?.[1];
      if (jsonStr) {
        const parsed = JSON.parse(jsonStr) as Array<{
          drawno: string;
          date: string;
          no1: string; no2: string; no3: string;
          no4: string; no5: string; no6: string;
          xno: string;
        }>;
        for (const item of parsed) {
          const nums = [item.no1, item.no2, item.no3, item.no4, item.no5, item.no6]
            .map(Number)
            .filter((n) => n >= 1 && n <= 49)
            .sort((a, b) => a - b);
          if (nums.length === 6) {
            draws.push({
              id: item.drawno,
              date: normalizeDate(item.date),
              numbers: nums,
              extra: item.xno ? Number(item.xno) : null,
            });
          }
        }
        return draws;
      }
    } catch {
      // fallback to regex
    }
  }

  // Regex-based HTML parse
  const cellRe = /<td[^>]*class="[^"]*(?:drawdate|draw-date|date)[^"]*"[^>]*>(.*?)<\/td>/gi;
  const ballRe = /class="[^"]*(?:ball|lotto|number)[^"]*"[^>]*>(\d{1,2})<\/(?:span|div|td)>/gi;
  const extraRe = /class="[^"]*(?:extra|xno|bonus)[^"]*"[^>]*>(\d{1,2})<\/(?:span|div|td)>/gi;

  return draws;
}

function normalizeDate(raw: string): string {
  // Handle dd/MM/yyyy or yyyy/MM/dd or other formats
  if (!raw) return new Date().toISOString().split("T")[0]!;
  const parts = raw.split(/[\/\-]/);
  if (parts.length !== 3) return raw;
  // Detect yyyy/MM/dd
  if (parts[0]!.length === 4) return `${parts[0]}-${parts[1]!.padStart(2, "0")}-${parts[2]!.padStart(2, "0")}`;
  // dd/MM/yyyy
  return `${parts[2]}-${parts[1]!.padStart(2, "0")}-${parts[0]!.padStart(2, "0")}`;
}

// ─── Alternative: HKJC JSON API ─────────────────────────────────────────────

async function fetchHKJCJson(drawCount = 10): Promise<HKJCDraw[]> {
  const urls = [
    `https://bet.hkjc.com/marksix/getResults.aspx?lang=en&submenu=e_RS`,
    `https://www.hklotto.com/service/hklotto/results.json`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; HKTotoPro/1.0)" },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const text = await res.text();
      const draws = tryParseResults(text);
      if (draws.length > 0) return draws;
    } catch {
      continue;
    }
  }
  return [];
}

function tryParseResults(raw: string): HKJCDraw[] {
  const draws: HKJCDraw[] = [];
  try {
    const json = JSON.parse(raw);
    if (Array.isArray(json)) {
      for (const item of json) {
        const nums = extractNums(item);
        if (nums.length === 6) {
          draws.push({
            id: String(item.drawno ?? item.id ?? item.period ?? ""),
            date: normalizeDate(String(item.date ?? item.drawdate ?? item.draw_date ?? "")),
            numbers: nums,
            extra: item.extra ?? item.xno ?? item.bonus ?? null,
          });
        }
      }
    }
  } catch {
    // not JSON
  }
  return draws;
}

function extractNums(item: Record<string, unknown>): number[] {
  const candidates: number[] = [];
  for (const key of ["no1","no2","no3","no4","no5","no6","n1","n2","n3","n4","n5","n6"]) {
    const v = Number(item[key]);
    if (v >= 1 && v <= 49) candidates.push(v);
  }
  if (candidates.length === 6) return candidates.sort((a, b) => a - b);
  const nums = item["numbers"];
  if (Array.isArray(nums)) {
    const arr = nums.map(Number).filter((n: number) => n >= 1 && n <= 49);
    if (arr.length === 6) return arr.sort((a: number, b: number) => a - b);
  }
  return [];
}

// ─── Insert helpers ──────────────────────────────────────────────────────────

function insertDraw(draw: HKJCDraw): boolean {
  const existing = db
    .prepare("SELECT id FROM results WHERE draw_date = ? AND period = ?")
    .get(draw.date, draw.id);
  if (existing) return false;

  // Also check by date + numbers to avoid exact duplicates
  const byDate = db
    .prepare("SELECT id FROM results WHERE draw_date = ?")
    .get(draw.date);
  if (byDate) return false;

  const [n1, n2, n3, n4, n5, n6] = draw.numbers;
  db.prepare(
    `INSERT INTO results (draw_date, period, n1, n2, n3, n4, n5, n6, extra, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'auto')`
  ).run(draw.date, draw.id || null, n1!, n2!, n3!, n4!, n5!, n6!, draw.extra);
  return true;
}

// ─── Sync log table ──────────────────────────────────────────────────────────

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
  const total = (db.prepare("SELECT COUNT(*) as c FROM results WHERE source='auto'").get() as { c: number }).c;
  return { last, totalAutoRecords: total };
}

// ─── Main sync function ───────────────────────────────────────────────────────

export async function syncResults(): Promise<SyncResult> {
  initSyncLog();
  const result: SyncResult = {
    added: 0,
    skipped: 0,
    errors: [],
    lastDrawDate: null,
    fetchedAt: new Date().toISOString(),
  };

  logger.info("Starting HK results sync...");

  try {
    const draws = await fetchHKJCJson();

    if (draws.length === 0) {
      result.errors.push("No draws returned from remote source");
      logSync(0, 0, "empty", "No draws returned");
      return result;
    }

    for (const draw of draws) {
      try {
        const wasInserted = insertDraw(draw);
        if (wasInserted) {
          result.added++;
          result.lastDrawDate = draw.date;
          logger.info({ date: draw.date, nums: draw.numbers }, "Inserted new draw");
        } else {
          result.skipped++;
        }
      } catch (err) {
        result.errors.push(`Failed draw ${draw.date}: ${String(err)}`);
      }
    }

    logSync(result.added, result.skipped, "ok");
    logger.info({ added: result.added, skipped: result.skipped }, "Sync complete");
  } catch (err) {
    const msg = String(err);
    result.errors.push(msg);
    logSync(0, 0, "error", msg);
    logger.error({ err }, "Sync failed");
  }

  return result;
}
