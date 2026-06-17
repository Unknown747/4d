import { Router } from "express";
import { db } from "../db/sqlite.js";

const router = Router();

interface ResultRow {
  id: number;
  draw_date: string;
  period: string | null;
  n1: number; n2: number; n3: number; n4: number; n5: number; n6: number;
  extra: number | null;
}

function getAllNumbers(row: ResultRow): number[] {
  return [row.n1, row.n2, row.n3, row.n4, row.n5, row.n6];
}

function buildStats(rows: ResultRow[]) {
  const freq: Record<number, number> = {};
  const lastSeen: Record<number, number> = {};
  for (let n = 1; n <= 49; n++) freq[n] = 0;

  rows.forEach((row, idx) => {
    getAllNumbers(row).forEach((n) => {
      freq[n]!++;
      if (lastSeen[n] === undefined) lastSeen[n] = idx;
    });
  });

  for (let n = 1; n <= 49; n++) {
    if (lastSeen[n] === undefined) lastSeen[n] = rows.length;
  }

  return { freq, lastSeen };
}

router.get("/stats", (req, res): void => {
  const rows = db.prepare(
    `SELECT * FROM results ORDER BY draw_date DESC, id DESC LIMIT 200`
  ).all() as ResultRow[];

  if (rows.length === 0) { res.json({ freq: {}, hot: [], cold: [], overdue: [] }); return; }

  const { freq, lastSeen } = buildStats(rows);

  const total = rows.length;
  const numbers = Array.from({ length: 49 }, (_, i) => i + 1);

  const withStats = numbers.map((n) => ({
    number: n,
    frequency: freq[n]!,
    pct: parseFloat(((freq[n]! / total) * 100).toFixed(1)),
    lastDrawsAgo: lastSeen[n]!,
    isHot: lastSeen[n]! < 5,
    isCold: lastSeen[n]! > 15,
  }));

  const hotNums = [...withStats].sort((a, b) => b.frequency - a.frequency).slice(0, 10);
  const coldNums = [...withStats].sort((a, b) => a.frequency - b.frequency).slice(0, 10);
  const overdueNums = [...withStats].sort((a, b) => b.lastDrawsAgo - a.lastDrawsAgo).slice(0, 10);

  res.json({
    totalDraws: total,
    numbers: withStats,
    hot: hotNums,
    cold: coldNums,
    overdue: overdueNums,
    latestDraw: rows[0],
  });
});

router.get("/predict", (req, res): void => {
  const mode = (req.query["mode"] as string) ?? "balanced";
  const rows = db.prepare(
    `SELECT * FROM results ORDER BY draw_date DESC, id DESC LIMIT 100`
  ).all() as ResultRow[];

  if (rows.length < 5) {
    res.status(400).json({ error: "Not enough data. Add at least 5 draws first." }); return;
  }

  const { freq, lastSeen } = buildStats(rows);
  const totalDraws = rows.length;

  const recentRows = rows.slice(0, 20);
  const recentFreq: Record<number, number> = {};
  for (let n = 1; n <= 49; n++) recentFreq[n] = 0;
  recentRows.forEach((row) => getAllNumbers(row).forEach((n) => recentFreq[n]!++));

  const scores: Record<number, number> = {};
  for (let n = 1; n <= 49; n++) {
    const freqScore = freq[n]! / totalDraws;
    const recentScore = recentFreq[n]! / 20;
    const overdueScore = Math.min(lastSeen[n]! / 15, 1.5);

    if (mode === "hot") {
      scores[n] = freqScore * 0.3 + recentScore * 0.7;
    } else if (mode === "cold") {
      scores[n] = (1 - freqScore) * 0.4 + overdueScore * 0.6;
    } else {
      scores[n] = freqScore * 0.35 + recentScore * 0.35 + overdueScore * 0.3;
    }
  }

  function weightedPick(exclude: number[]): number {
    const candidates = Array.from({ length: 49 }, (_, i) => i + 1).filter(
      (n) => !exclude.includes(n)
    );
    const totalWeight = candidates.reduce((s, n) => s + (scores[n] ?? 0), 0);
    let r = Math.random() * totalWeight;
    for (const n of candidates) {
      r -= scores[n] ?? 0;
      if (r <= 0) return n;
    }
    return candidates[candidates.length - 1]!;
  }

  const predictions: number[] = [];
  for (let i = 0; i < 6; i++) {
    predictions.push(weightedPick(predictions));
  }
  predictions.sort((a, b) => a - b);

  const extraPool = Array.from({ length: 49 }, (_, i) => i + 1).filter(
    (n) => !predictions.includes(n)
  );
  const extra = extraPool[Math.floor(Math.random() * extraPool.length)]!;

  const confidence = Math.min(
    Math.round(55 + predictions.reduce((s, n) => s + scores[n]!, 0) * 50),
    92
  );

  const explanations = predictions.map((n) => ({
    number: n,
    frequency: freq[n]!,
    pct: parseFloat(((freq[n]! / totalDraws) * 100).toFixed(1)),
    lastDrawsAgo: lastSeen[n]!,
    score: parseFloat((scores[n]! * 100).toFixed(2)),
    reason:
      lastSeen[n]! > 10
        ? "Overdue"
        : recentFreq[n]! >= 3
        ? "Hot streak"
        : freq[n]! > totalDraws * 0.15
        ? "High frequency"
        : "Statistical pick",
  }));

  res.json({
    predictions,
    extra,
    mode,
    confidence,
    totalDrawsAnalyzed: totalDraws,
    explanations,
    generatedAt: new Date().toISOString(),
  });
});

router.get("/history-chart", (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM results ORDER BY draw_date DESC, id DESC LIMIT 30`
  ).all() as ResultRow[];

  const data = rows.reverse().map((r) => ({
    date: r.draw_date,
    period: r.period,
    numbers: getAllNumbers(r),
    extra: r.extra,
    sum: getAllNumbers(r).reduce((a, b) => a + b, 0),
    evenCount: getAllNumbers(r).filter((n) => n % 2 === 0).length,
  }));

  res.json({ data });
});

export default router;
