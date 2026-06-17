import { Router } from "express";
import { db } from "../db/sqlite.js";

const router = Router();

interface Row {
  id: number;
  draw_date: string;
  result_4d: string;
  result_3d: string;
  result_2d: string;
  source: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildPosFreq(rows: Row[]) {
  const posFreq: number[][] = Array.from({ length: 4 }, () => Array(10).fill(0));
  const lastSeen: number[][] = Array.from({ length: 4 }, () => Array(10).fill(rows.length));
  rows.forEach((row, idx) => {
    const s = row.result_4d.padStart(4, "0");
    for (let p = 0; p < 4; p++) {
      const d = parseInt(s[p]!);
      posFreq[p]![d]!++;
      if (lastSeen[p]![d] === rows.length) lastSeen[p]![d] = idx;
    }
  });
  return { posFreq, lastSeen };
}

function build2dFreq(rows: Row[]) {
  const freq: Record<string, { count: number; lastIdx: number }> = {};
  rows.forEach((row, idx) => {
    const key = row.result_2d;
    if (!freq[key]) freq[key] = { count: 0, lastIdx: rows.length };
    freq[key]!.count++;
    if (freq[key]!.lastIdx === rows.length) freq[key]!.lastIdx = idx;
  });
  return freq;
}

function build3dFreq(rows: Row[]) {
  const freq: Record<string, { count: number; lastIdx: number }> = {};
  rows.forEach((row, idx) => {
    const key = row.result_3d;
    if (!freq[key]) freq[key] = { count: 0, lastIdx: rows.length };
    freq[key]!.count++;
    if (freq[key]!.lastIdx === rows.length) freq[key]!.lastIdx = idx;
  });
  return freq;
}

function weightedPickDigit(
  posFreq: number[],
  lastSeen: number[],
  mode: string,
  total: number
): number {
  const weights = posFreq.map((count, d) => {
    const freqW = count / (total || 1);
    const recentW = 1 / (lastSeen[d]! + 1);
    const overdueW = (lastSeen[d]! + 1) / (total + 1);
    if (mode === "hot") return freqW * 0.4 + recentW * 0.6 + 0.01;
    if (mode === "cold") return (1 - freqW) * 0.4 + overdueW * 0.6 + 0.01;
    return freqW * 0.35 + recentW * 0.35 + overdueW * 0.3 + 0.01;
  });
  const totalW = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * totalW;
  for (let d = 0; d < 10; d++) {
    r -= weights[d]!;
    if (r <= 0) return d;
  }
  return 9;
}

// ─── /api/stats ────────────────────────────────────────────────────────────

router.get("/stats", (req, res): void => {
  const rows = db.prepare(
    `SELECT * FROM hk4d_results ORDER BY draw_date DESC LIMIT 100`
  ).all() as Row[];

  if (rows.length === 0) {
    res.json({ totalDraws: 0, recentResults: [], posStats: [], hot2D: [], overdue2D: [], freq2D: [], freq3D: [] });
    return;
  }

  const total = rows.length;
  const { posFreq, lastSeen } = buildPosFreq(rows);
  const freq2D = build2dFreq(rows);
  const freq3D = build3dFreq(rows);

  // Positional analysis
  const posStats = [0, 1, 2, 3].map((p) => {
    const digits = Array.from({ length: 10 }, (_, d) => ({
      digit: d,
      count: posFreq[p]![d]!,
      pct: parseFloat(((posFreq[p]![d]! / total) * 100).toFixed(1)),
      lastDrawsAgo: lastSeen[p]![d]!,
    }));
    const hotDigit = [...digits].sort((a, b) => a.lastDrawsAgo - b.lastDrawsAgo)[0]!;
    const coldDigit = [...digits].sort((a, b) => b.lastDrawsAgo - a.lastDrawsAgo)[0]!;
    const freqDigit = [...digits].sort((a, b) => b.count - a.count)[0]!;
    return { pos: p + 1, label: ["AS(P1)", "KOP(P2)", "KEPALA", "EKOR"][p], digits, hotDigit, coldDigit, freqDigit };
  });

  // 2D analysis
  const sorted2D = Object.entries(freq2D).map(([num, { count, lastIdx }]) => ({
    number: num,
    count,
    lastDrawsAgo: lastIdx,
    isHot: lastIdx < 5,
    isOverdue: lastIdx > 10,
  }));

  const hot2D = [...sorted2D].sort((a, b) => a.lastDrawsAgo - b.lastDrawsAgo).slice(0, 12);
  const freq2DTop = [...sorted2D].sort((a, b) => b.count - a.count || a.lastDrawsAgo - b.lastDrawsAgo).slice(0, 12);
  const overdue2D = sorted2D.filter((x) => x.lastDrawsAgo > 10).sort((a, b) => b.lastDrawsAgo - a.lastDrawsAgo).slice(0, 12);

  // 3D frequency
  const freq3DTop = Object.entries(freq3D)
    .map(([num, { count, lastIdx }]) => ({ number: num, count, lastDrawsAgo: lastIdx }))
    .sort((a, b) => b.count - a.count || a.lastDrawsAgo - b.lastDrawsAgo)
    .slice(0, 15);

  // Ekor / Kepala analysis
  const kepalaCounts = Array(10).fill(0);
  const ekorCounts = Array(10).fill(0);
  const kepalaSeen = Array(10).fill(total);
  const ekorSeen = Array(10).fill(total);
  rows.forEach((row, idx) => {
    const s = row.result_4d.padStart(4, "0");
    const kep = parseInt(s[2]!);
    const ek = parseInt(s[3]!);
    kepalaCounts[kep]++;
    ekorCounts[ek]++;
    if (kepalaSeen[kep] === total) kepalaSeen[kep] = idx;
    if (ekorSeen[ek] === total) ekorSeen[ek] = idx;
  });

  const kepalaStats = Array.from({ length: 10 }, (_, d) => ({
    digit: d,
    count: kepalaCounts[d],
    pct: parseFloat(((kepalaCounts[d] / total) * 100).toFixed(1)),
    lastDrawsAgo: kepalaSeen[d],
  }));
  const ekorStats = Array.from({ length: 10 }, (_, d) => ({
    digit: d,
    count: ekorCounts[d],
    pct: parseFloat(((ekorCounts[d] / total) * 100).toFixed(1)),
    lastDrawsAgo: ekorSeen[d],
  }));

  res.json({
    totalDraws: total,
    latestResult: rows[0],
    recentResults: rows.slice(0, 10),
    posStats,
    hot2D,
    freq2D: freq2DTop,
    overdue2D,
    freq3D: freq3DTop,
    kepalaStats,
    ekorStats,
  });
});

// ─── /api/predict ──────────────────────────────────────────────────────────

router.get("/predict", (req, res): void => {
  const type = (req.query["type"] as string) ?? "2d";
  const mode = (req.query["mode"] as string) ?? "hot";

  const rows = db.prepare(
    `SELECT * FROM hk4d_results ORDER BY draw_date DESC LIMIT 60`
  ).all() as Row[];

  if (rows.length < 3) {
    res.status(400).json({ error: "Data kurang, tambahkan minimal 3 result dahulu." });
    return;
  }

  const total = rows.length;

  if (type === "2d") {
    const freq2D = build2dFreq(rows);
    const all2D = Object.entries(freq2D).map(([num, { count, lastIdx }]) => {
      const freqW = count / total;
      const recentW = 1 / (lastIdx + 1);
      const overdueW = (lastIdx + 1) / (total + 1);
      let score: number;
      if (mode === "hot") score = freqW * 0.4 + recentW * 0.6;
      else if (mode === "cold") score = (1 - freqW) * 0.5 + overdueW * 0.5;
      else score = freqW * 0.4 + recentW * 0.3 + overdueW * 0.3;
      return { number: num, count, lastDrawsAgo: lastIdx, score };
    });

    // Also generate positional-based 2D candidates
    const { posFreq, lastSeen } = buildPosFreq(rows);
    const posKep = Array.from({ length: 10 }, (_, d) => ({
      d,
      w: posFreq[2]![d]! / total + 1 / (lastSeen[2]![d]! + 1),
    }));
    const posEkor = Array.from({ length: 10 }, (_, d) => ({
      d,
      w: posFreq[3]![d]! / total + 1 / (lastSeen[3]![d]! + 1),
    }));
    const hotKep = posKep.sort((a, b) => b.w - a.w)[0]!.d;
    const hotEkor = posEkor.sort((a, b) => b.w - a.w)[0]!.d;
    const positionalNum = `${hotKep}${hotEkor}`;

    const sorted = all2D.sort((a, b) => b.score - a.score);
    const top = sorted.slice(0, 8);

    // Add positional candidate if not already there
    if (!top.find((x) => x.number === positionalNum)) {
      top.push({ number: positionalNum, count: freq2D[positionalNum]?.count ?? 0, lastDrawsAgo: freq2D[positionalNum]?.lastIdx ?? 99, score: 0.5 });
    }

    res.json({
      type: "2d",
      mode,
      predictions: top.slice(0, 8).map((x) => ({
        number: x.number,
        count: x.count,
        lastDrawsAgo: x.lastDrawsAgo,
        score: Math.round(50 + x.score * 500),
        reason:
          x.lastDrawsAgo === 0
            ? "🔥 Muncul di draw terbaru!"
            : x.lastDrawsAgo < 3
            ? `⚡ Sangat hot — ${x.lastDrawsAgo} draw lalu`
            : x.count >= 2
            ? `📊 Muncul ${x.count}x dalam data`
            : x.lastDrawsAgo > 15
            ? `🧊 Overdue — ${x.lastDrawsAgo} draw absen`
            : `📈 Score analitik tinggi`,
      })),
      totalDrawsAnalyzed: total,
    });
  } else if (type === "3d") {
    const freq3D = build3dFreq(rows);
    const { posFreq, lastSeen } = buildPosFreq(rows);

    const all3D = Object.entries(freq3D).map(([num, { count, lastIdx }]) => {
      const freqW = count / total;
      const recentW = 1 / (lastIdx + 1);
      const overdueW = (lastIdx + 1) / (total + 1);
      let score: number;
      if (mode === "hot") score = freqW * 0.4 + recentW * 0.6;
      else if (mode === "cold") score = (1 - freqW) * 0.5 + overdueW * 0.5;
      else score = freqW * 0.4 + recentW * 0.3 + overdueW * 0.3;
      return { number: num, count, lastDrawsAgo: lastIdx, score };
    });

    const sorted3D = all3D.sort((a, b) => b.score - a.score).slice(0, 5);
    const predictions = sorted3D.map((x) => ({
      number: x.number,
      count: x.count,
      lastDrawsAgo: x.lastDrawsAgo,
      score: Math.round(50 + x.score * 400),
      reason:
        x.count >= 2
          ? `Muncul ${x.count}x dalam data`
          : x.lastDrawsAgo < 5
          ? `Hot — ${x.lastDrawsAgo} draw lalu`
          : x.lastDrawsAgo > 15
          ? `Overdue — ${x.lastDrawsAgo} draw absen`
          : "Pola posisional",
    }));

    // Add 2 positional-generated candidates
    for (let attempt = 0; attempt < 3; attempt++) {
      const digits = [1, 2, 3].map((p) => weightedPickDigit(posFreq[p]!, lastSeen[p]!, mode, total));
      const num = digits.map(String).join("");
      if (!predictions.find((x) => x.number === num)) {
        predictions.push({
          number: num,
          count: freq3D[num]?.count ?? 0,
          lastDrawsAgo: freq3D[num]?.lastIdx ?? 99,
          score: Math.round(50 + Math.random() * 25),
          reason: "Kombinasi digit terpanas per posisi",
        });
        if (predictions.length >= 7) break;
      }
    }

    res.json({ type: "3d", mode, predictions: predictions.slice(0, 7), totalDrawsAnalyzed: total });
  } else {
    // 4D
    const { posFreq, lastSeen } = buildPosFreq(rows);

    const predictions: { number: string; count: number; lastDrawsAgo: number; score: number; reason: string }[] = [];

    // Strategy 1: hottest digit per position
    const hotDigits = [0, 1, 2, 3].map((p) => {
      let best = 0;
      let bestScore = -1;
      for (let d = 0; d < 10; d++) {
        const s = posFreq[p]![d]! / total + 5 / (lastSeen[p]![d]! + 1);
        if (s > bestScore) { bestScore = s; best = d; }
      }
      return best;
    });
    const hot4D = hotDigits.map(String).join("").padStart(4, "0");
    const rowFreq = db.prepare("SELECT COUNT(*) as c FROM hk4d_results WHERE result_4d = ?").get(hot4D) as { c: number };
    predictions.push({ number: hot4D, count: rowFreq.c, lastDrawsAgo: 0, score: 88, reason: "🔥 Digit terpanas setiap posisi" });

    // Strategy 2: most frequent digit per position
    const freqDigits = [0, 1, 2, 3].map((p) => {
      let best = 0, bestCount = -1;
      for (let d = 0; d < 10; d++) {
        if (posFreq[p]![d]! > bestCount) { bestCount = posFreq[p]![d]!; best = d; }
      }
      return best;
    });
    const freq4D = freqDigits.map(String).join("").padStart(4, "0");
    if (freq4D !== hot4D) {
      const f = db.prepare("SELECT COUNT(*) as c FROM hk4d_results WHERE result_4d = ?").get(freq4D) as { c: number };
      predictions.push({ number: freq4D, count: f.c, lastDrawsAgo: 0, score: 82, reason: "📊 Digit paling sering setiap posisi" });
    }

    // Strategy 3: overdue — digit not seen recently per position
    const overdueDigits = [0, 1, 2, 3].map((p) => {
      let worst = 0, worstSeen = -1;
      for (let d = 0; d < 10; d++) {
        if (lastSeen[p]![d]! > worstSeen && posFreq[p]![d]! > 0) {
          worstSeen = lastSeen[p]![d]!; worst = d;
        }
      }
      return worst;
    });
    const overdue4D = overdueDigits.map(String).join("").padStart(4, "0");
    if (!predictions.find((x) => x.number === overdue4D)) {
      const f = db.prepare("SELECT COUNT(*) as c FROM hk4d_results WHERE result_4d = ?").get(overdue4D) as { c: number };
      predictions.push({ number: overdue4D, count: f.c, lastDrawsAgo: 0, score: 75, reason: "🧊 Digit overdue setiap posisi" });
    }

    // Strategy 4–7: weighted random picks
    for (let i = 0; i < 5; i++) {
      const digits = [0, 1, 2, 3].map((p) => weightedPickDigit(posFreq[p]!, lastSeen[p]!, mode, total));
      const num = digits.map(String).join("").padStart(4, "0");
      if (!predictions.find((x) => x.number === num)) {
        const f = db.prepare("SELECT COUNT(*) as c FROM hk4d_results WHERE result_4d = ?").get(num) as { c: number };
        predictions.push({
          number: num, count: f.c, lastDrawsAgo: 0,
          score: Math.round(60 + Math.random() * 20),
          reason: `${mode === "hot" ? "Hot" : mode === "cold" ? "Cold" : "Balanced"} weighted pick`,
        });
        if (predictions.length >= 8) break;
      }
    }

    res.json({ type: "4d", mode, predictions: predictions.slice(0, 8), totalDrawsAnalyzed: total });
  }
});

// ─── /api/bb-campuran ──────────────────────────────────────────────────────
// Generate all 4D permutations (with repetition) from selected active digits,
// score each using positional frequency analysis, return top 10.

router.get("/bb-campuran", (req, res): void => {
  const rawDigits = (req.query["digits"] as string) ?? "";
  const mode = (req.query["mode"] as string) ?? "hot";

  // Parse & validate active digits
  const activeDigits = [...new Set(rawDigits.replace(/\D/g, "").split("").map(Number))].sort((a, b) => a - b);

  if (activeDigits.length < 2) {
    res.status(400).json({ error: "Pilih minimal 2 digit aktif." });
    return;
  }
  if (activeDigits.length > 9) {
    res.status(400).json({ error: "Maksimal 9 digit aktif." });
    return;
  }

  const rows = db.prepare(
    `SELECT * FROM hk4d_results ORDER BY draw_date DESC LIMIT 60`
  ).all() as Row[];

  if (rows.length < 3) {
    res.status(400).json({ error: "Data kurang, tambahkan minimal 3 result dahulu." });
    return;
  }

  const total = rows.length;
  const { posFreq, lastSeen } = buildPosFreq(rows);

  // Score a single digit at a given position
  function posScore(pos: number, digit: number): number {
    const count = posFreq[pos]![digit]!;
    const seen = lastSeen[pos]![digit]!;
    const freqW = count / total;
    const recentW = 1 / (seen + 1);
    const overdueW = (seen + 1) / (total + 1);
    if (mode === "hot")     return freqW * 0.4 + recentW * 0.6;
    if (mode === "cold")    return (1 - freqW) * 0.5 + overdueW * 0.5;
    return freqW * 0.4 + recentW * 0.3 + overdueW * 0.3;
  }

  // Generate all combinations (with repetition): activeDigits^4
  const n = activeDigits.length;
  const totalCombinations = n * n * n * n;

  const candidates: { number: string; score: number }[] = [];

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        for (let l = 0; l < n; l++) {
          const d0 = activeDigits[i]!;
          const d1 = activeDigits[j]!;
          const d2 = activeDigits[k]!;
          const d3 = activeDigits[l]!;
          const num = `${d0}${d1}${d2}${d3}`;
          const score = posScore(0, d0) + posScore(1, d1) + posScore(2, d2) + posScore(3, d3);
          candidates.push({ number: num, score });
        }
      }
    }
  }

  // Sort descending, take top 10
  candidates.sort((a, b) => b.score - a.score);
  const top10 = candidates.slice(0, 10);

  // Normalize scores to 0–100 range for display
  const maxScore = top10[0]!.score;
  const minScore = candidates[candidates.length - 1]!.score;
  const range = maxScore - minScore || 1;

  const predictions = top10.map((c, i) => {
    const s = c.number.padStart(4, "0");
    const result3d = s.slice(1);
    const result2d = s.slice(2);
    const displayScore = Math.round(60 + ((c.score - minScore) / range) * 40);
    const reason =
      i === 0 ? "⭐ Kombinasi digit terkuat" :
      i < 3   ? "🔥 Skor posisional tinggi" :
      i < 6   ? "📊 Pola frekuensi baik" :
                "📈 Kandidat alternatif";
    return { number: s, result3d, result2d, score: displayScore, reason };
  });

  res.json({
    activeDigits,
    mode,
    totalCombinations,
    predictions,
    totalDrawsAnalyzed: total,
  });
});

// ─── /api/history-chart ────────────────────────────────────────────────────

router.get("/history-chart", (req, res) => {
  const rows = db.prepare(
    `SELECT * FROM hk4d_results ORDER BY draw_date DESC LIMIT 30`
  ).all() as Row[];

  const data = rows.reverse().map((r) => {
    const s = r.result_4d.padStart(4, "0");
    const digits = [parseInt(s[0]!), parseInt(s[1]!), parseInt(s[2]!), parseInt(s[3]!)];
    return {
      date: r.draw_date,
      result_4d: r.result_4d,
      result_2d: r.result_2d,
      digitSum: digits.reduce((a, b) => a + b, 0),
      ekor: digits[3],
      kepala: digits[2],
    };
  });

  res.json({ data });
});

export default router;
