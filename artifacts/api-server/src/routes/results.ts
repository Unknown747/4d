import { Router } from "express";
import { db } from "../db/sqlite.js";

const router = Router();

router.get("/results", (req, res) => {
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
  const offset = Number(req.query["offset"] ?? 0);
  const rows = db.prepare(
    `SELECT * FROM results ORDER BY draw_date DESC, id DESC LIMIT ? OFFSET ?`
  ).all(limit, offset);
  const total = (db.prepare("SELECT COUNT(*) as c FROM results").get() as { c: number }).c;
  res.json({ data: rows, total, limit, offset });
});

router.get("/results/:id", (req, res): void => {
  const row = db.prepare("SELECT * FROM results WHERE id = ?").get(req.params["id"]);
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(row);
});

router.post("/results", (req, res): void => {
  const { draw_date, period, n1, n2, n3, n4, n5, n6, extra } = req.body;
  if (!draw_date || !n1 || !n2 || !n3 || !n4 || !n5 || !n6) {
    res.status(400).json({ error: "Missing required fields" }); return;
  }
  const nums = [n1, n2, n3, n4, n5, n6].map(Number);
  if (nums.some((n) => n < 1 || n > 49)) {
    res.status(400).json({ error: "Numbers must be between 1 and 49" }); return;
  }
  const unique = new Set(nums);
  if (unique.size < 6) {
    res.status(400).json({ error: "Numbers must be unique" }); return;
  }
  const sorted = nums.sort((a, b) => a - b);
  const result = db.prepare(
    `INSERT INTO results (draw_date, period, n1, n2, n3, n4, n5, n6, extra, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`
  ).run(draw_date, period ?? null, ...sorted, extra ? Number(extra) : null);
  const row = db.prepare("SELECT * FROM results WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json(row);
});

router.delete("/results/:id", (req, res): void => {
  const info = db.prepare("DELETE FROM results WHERE id = ?").run(req.params["id"]);
  if (info.changes === 0) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ success: true });
});

export default router;
