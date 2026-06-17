import { Router } from "express";
import { db, derive4d } from "../db/sqlite.js";
import { logger } from "../lib/logger.js";

const router = Router();

router.get("/results", (req, res) => {
  const market = (req.query["market"] as string) ?? "sgp";
  const limit = Math.min(Number(req.query["limit"] ?? 20), 200);
  const offset = Number(req.query["offset"] ?? 0);
  const rows = db.prepare(
    `SELECT * FROM hk4d_results WHERE market = ? ORDER BY draw_date DESC LIMIT ? OFFSET ?`
  ).all(market, limit, offset);
  const total = (db.prepare("SELECT COUNT(*) as c FROM hk4d_results WHERE market = ?").get(market) as { c: number }).c;
  res.json({ data: rows, total, limit, offset, market });
});

router.get("/results/:id", (req, res): void => {
  const row = db.prepare("SELECT * FROM hk4d_results WHERE id = ?").get(req.params["id"]);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/results", (req, res): void => {
  const { draw_date, result_4d, market: rawMarket } = req.body;
  const market = (rawMarket === "sdy" ? "sdy" : "sgp");

  if (!draw_date || !result_4d) {
    res.status(400).json({ error: "draw_date dan result_4d wajib diisi" }); return;
  }
  const r = String(result_4d).padStart(4, "0");
  if (!/^\d{4}$/.test(r)) {
    res.status(400).json({ error: "result_4d harus 4 digit angka (0000–9999)" }); return;
  }
  const { r3d, r2d } = derive4d(r);
  try {
    const info = db.prepare(
      `INSERT INTO hk4d_results (market, draw_date, result_4d, result_3d, result_2d, source)
       VALUES (?, ?, ?, ?, ?, 'manual')`
    ).run(market, draw_date, r, r3d, r2d);
    const row = db.prepare("SELECT * FROM hk4d_results WHERE id = ?").get(info.lastInsertRowid);

    // Verifikasi SEMUA rekomendasi yang belum dicek untuk market ini
    try {
      interface RekRow { id: number; predictions_json: string; }
      const unchecked = db.prepare(`
        SELECT id, predictions_json FROM rekomendasi_history
        WHERE market = ? AND based_on_date < ? AND actual_4d IS NULL
        ORDER BY based_on_date ASC
      `).all(market, draw_date) as RekRow[];

      if (unchecked.length > 0) {
        const updateStmt = db.prepare(`
          UPDATE rekomendasi_history
          SET actual_4d = ?, actual_3d = ?, actual_2d = ?,
              hit_4d = ?, hit_3d = ?, hit_2d = ?,
              checked_at = datetime('now')
          WHERE id = ?
        `);
        const doVerify = db.transaction(() => {
          for (const rek of unchecked) {
            let preds: { num4d: string; num3d: string; num2d: string }[] = [];
            try { preds = JSON.parse(rek.predictions_json); } catch { preds = []; }
            const pred4Ds = new Set(preds.map(p => p.num4d));
            const pred3Ds = new Set(preds.map(p => p.num3d));
            const pred2Ds = new Set(preds.map(p => p.num2d));
            updateStmt.run(r, r3d, r2d, pred4Ds.has(r) ? 1 : 0, pred3Ds.has(r3d) ? 1 : 0, pred2Ds.has(r2d) ? 1 : 0, rek.id);
          }
        });
        doVerify();
      }
    } catch (rekErr) {
      logger.error({ err: rekErr }, "Gagal update rekomendasi_history win-rate");
    }

    res.status(201).json(row);
  } catch (err: any) {
    if (err?.code === "SQLITE_CONSTRAINT_UNIQUE" || err?.message?.includes("UNIQUE")) {
      res.status(409).json({ error: `Tanggal ${draw_date} (${market.toUpperCase()}) sudah ada. Hapus dulu jika ingin update.` });
    } else {
      res.status(500).json({ error: String(err) });
    }
  }
});

router.delete("/results/:id", (req, res): void => {
  const info = db.prepare("DELETE FROM hk4d_results WHERE id = ?").run(req.params["id"]);
  if (info.changes === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true });
});

export default router;
