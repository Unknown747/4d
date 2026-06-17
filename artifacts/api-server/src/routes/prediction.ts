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

// ─── Shio mapping ──────────────────────────────────────────────────────────

const SHIO_DEF = [
  { name: "Tikus",   emoji: "🐭", nums: [0,12,24,36,48,60,72,84,96] },
  { name: "Kerbau",  emoji: "🐂", nums: [1,13,25,37,49,61,73,85,97] },
  { name: "Macan",   emoji: "🐯", nums: [2,14,26,38,50,62,74,86,98] },
  { name: "Kelinci", emoji: "🐰", nums: [3,15,27,39,51,63,75,87,99] },
  { name: "Naga",    emoji: "🐲", nums: [4,16,28,40,52,64,76,88] },
  { name: "Ular",    emoji: "🐍", nums: [5,17,29,41,53,65,77,89] },
  { name: "Kuda",    emoji: "🐴", nums: [6,18,30,42,54,66,78,90] },
  { name: "Kambing", emoji: "🐐", nums: [7,19,31,43,55,67,79,91] },
  { name: "Monyet",  emoji: "🐒", nums: [8,20,32,44,56,68,80,92] },
  { name: "Ayam",    emoji: "🐓", nums: [9,21,33,45,57,69,81,93] },
  { name: "Anjing",  emoji: "🐕", nums: [10,22,34,46,58,70,82,94] },
  { name: "Babi",    emoji: "🐷", nums: [11,23,35,47,59,71,83,95] },
];

const SHIO_MAP: Record<string, { name: string; emoji: string }> = {};
for (const s of SHIO_DEF) {
  for (const n of s.nums) {
    SHIO_MAP[String(n).padStart(2, "0")] = { name: s.name, emoji: s.emoji };
  }
}

function getShio(twoD: string) {
  return SHIO_MAP[twoD.padStart(2, "0")] ?? { name: "?", emoji: "❓" };
}

// ─── Shared signal helpers ──────────────────────────────────────────────────

function buildShioSignals(rows: Row[], total: number) {
  const shioFreq: Record<string, { count: number; lastIdx: number }> = {};
  rows.forEach((row, idx) => {
    const k = getShio(row.result_4d.padStart(4, "0").slice(2)).name;
    if (!shioFreq[k]) shioFreq[k] = { count: 0, lastIdx: total };
    shioFreq[k]!.count++;
    if (shioFreq[k]!.lastIdx === total) shioFreq[k]!.lastIdx = idx;
  });
  const topShios = Object.entries(shioFreq)
    .map(([name, { count, lastIdx }]) => ({
      name,
      score: (count / total) * 0.35 + (1 / (lastIdx + 1)) * 0.3 + ((lastIdx + 1) / (total + 1)) * 0.35,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(s => s.name);
  const shio2Ds = new Set<string>();
  for (const s of SHIO_DEF) {
    if (topShios.includes(s.name)) {
      for (const n of s.nums) shio2Ds.add(String(n).padStart(2, "0"));
    }
  }
  return { topShios, shio2Ds };
}

function buildPolaSignals(rows: Row[]) {
  const ekorTrans: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));
  for (let i = 0; i < rows.length - 1; i++) {
    const pE = parseInt(rows[i + 1]!.result_4d.padStart(4, "0")[3]!);
    const cE = parseInt(rows[i]!.result_4d.padStart(4, "0")[3]!);
    ekorTrans[pE]![cE]!++;
  }
  const lastEkor = parseInt(rows[0]!.result_4d.padStart(4, "0")[3]!);
  const goodNextEkors = new Set(
    Array.from({ length: 10 }, (_, d) => d)
      .sort((a, b) => ekorTrans[lastEkor]![b]! - ekorTrans[lastEkor]![a]!)
      .slice(0, 3)
  );
  return { goodNextEkors };
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

  // Build exclusion sets from last 14 draws
  const recent14 = rows.slice(0, 14);
  const recentSet4D = new Set(recent14.map(r => r.result_4d.padStart(4, "0")));
  const recentSet3D = new Set(recent14.map(r => r.result_4d.padStart(4, "0").slice(1)));
  const recentSet2D = new Set(recent14.map(r => r.result_4d.padStart(4, "0").slice(2)));

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

    // Separate excluded from valid
    const excludedNums = sorted.filter(x => recentSet2D.has(x.number)).slice(0, 5).map(x => x.number);
    const valid = sorted.filter(x => !recentSet2D.has(x.number));
    const top = valid.slice(0, 8);

    // Add positional candidate if not already there and not excluded
    if (!top.find((x) => x.number === positionalNum) && !recentSet2D.has(positionalNum)) {
      top.push({ number: positionalNum, count: freq2D[positionalNum]?.count ?? 0, lastDrawsAgo: freq2D[positionalNum]?.lastIdx ?? 99, score: 0.5 });
    }

    res.json({
      type: "2d",
      mode,
      excludedNumbers: excludedNums,
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

    const sorted3D = all3D.sort((a, b) => b.score - a.score);
    const excludedNums3D = sorted3D.filter(x => recentSet3D.has(x.number)).slice(0, 5).map(x => x.number);
    const valid3D = sorted3D.filter(x => !recentSet3D.has(x.number));

    const predictions = valid3D.slice(0, 5).map((x) => ({
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

    // Add positional-generated candidates (filtered)
    for (let attempt = 0; attempt < 5; attempt++) {
      const digits = [1, 2, 3].map((p) => weightedPickDigit(posFreq[p]!, lastSeen[p]!, mode, total));
      const num = digits.map(String).join("");
      if (!predictions.find((x) => x.number === num) && !recentSet3D.has(num)) {
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

    res.json({ type: "3d", mode, excludedNumbers: excludedNums3D, predictions: predictions.slice(0, 7), totalDrawsAnalyzed: total });
  } else {
    // 4D
    const { posFreq, lastSeen } = buildPosFreq(rows);

    const allCandidates: { number: string; score: number; reason: string }[] = [];

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
    allCandidates.push({ number: hot4D, score: 88, reason: "🔥 Digit terpanas setiap posisi" });

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
      allCandidates.push({ number: freq4D, score: 82, reason: "📊 Digit paling sering setiap posisi" });
    }

    // Strategy 3: overdue
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
    if (!allCandidates.find((x) => x.number === overdue4D)) {
      allCandidates.push({ number: overdue4D, score: 75, reason: "🧊 Digit overdue setiap posisi" });
    }

    // Strategy 4–8: weighted random picks
    for (let i = 0; i < 8; i++) {
      const digits = [0, 1, 2, 3].map((p) => weightedPickDigit(posFreq[p]!, lastSeen[p]!, mode, total));
      const num = digits.map(String).join("").padStart(4, "0");
      if (!allCandidates.find((x) => x.number === num)) {
        allCandidates.push({ number: num, score: Math.round(60 + Math.random() * 20), reason: "Weighted positional pick" });
      }
    }

    // Separate excluded from valid
    const excludedNums4D = allCandidates.filter(x => recentSet4D.has(x.number)).slice(0, 5).map(x => x.number);
    const valid4D = allCandidates.filter(x => !recentSet4D.has(x.number));

    const predictions = valid4D.slice(0, 8).map(x => {
      const f = db.prepare("SELECT COUNT(*) as c FROM hk4d_results WHERE result_4d = ?").get(x.number) as { c: number };
      return { number: x.number, count: f.c, lastDrawsAgo: 0, score: x.score, reason: x.reason };
    });

    res.json({ type: "4d", mode, excludedNumbers: excludedNums4D, predictions, totalDrawsAnalyzed: total });
  }
});

// ─── /api/bb-campuran ──────────────────────────────────────────────────────
// Generate all 4D permutations (with repetition) from selected active digits,
// score each using positional frequency analysis, return top 10.

router.get("/bb-campuran", (req, res): void => {
  const rawDigits = (req.query["digits"] as string) ?? "";
  const mode = "balanced";
  const autoMode = !rawDigits || rawDigits.trim() === "";

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

  // Combined score of a digit across ALL 4 positions (used for auto-select)
  function digitTotalScore(digit: number): number {
    return posScore(0, digit) + posScore(1, digit) + posScore(2, digit) + posScore(3, digit);
  }

  let activeDigits: number[];
  let autoSelectedInfo: { digit: number; score: number }[] = [];

  if (autoMode) {
    // Auto-select top 5 digits by combined positional score
    const ranked = Array.from({ length: 10 }, (_, d) => ({ digit: d, score: digitTotalScore(d) }))
      .sort((a, b) => b.score - a.score);
    autoSelectedInfo = ranked.slice(0, 5);
    activeDigits = autoSelectedInfo.map(x => x.digit).sort((a, b) => a - b);
  } else {
    activeDigits = [...new Set(rawDigits.replace(/\D/g, "").split("").map(Number))].sort((a, b) => a - b);
    if (activeDigits.length < 2) {
      res.status(400).json({ error: "Pilih minimal 2 digit aktif." });
      return;
    }
    if (activeDigits.length > 9) {
      res.status(400).json({ error: "Maksimal 9 digit aktif." });
      return;
    }
  }

  // Build exclusion set: angka 4D yang sudah keluar dalam 14 draw terakhir
  const recentDrawn = new Set(
    rows.slice(0, 14).map(r => r.result_4d.padStart(4, "0"))
  );

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

  // Sort descending
  candidates.sort((a, b) => b.score - a.score);

  // Filter out recently drawn numbers, take top 10 from remainder
  const filtered = candidates.filter(c => !recentDrawn.has(c.number.padStart(4, "0")));
  const excluded = candidates.filter(c => recentDrawn.has(c.number.padStart(4, "0"))).slice(0, 5);
  const top10 = filtered.slice(0, 10);

  // Normalize scores to 0–100 range for display
  const maxScore = top10[0]?.score ?? 1;
  const minScore = filtered[filtered.length - 1]?.score ?? 0;
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

  const excludedNumbers = excluded.map(c => c.number.padStart(4, "0"));

  res.json({
    autoMode,
    activeDigits,
    autoSelectedInfo,
    totalCombinations,
    excludedCount: recentDrawn.size,
    excludedNumbers,
    predictions,
    totalDrawsAnalyzed: total,
  });
});

// ─── /api/shio ─────────────────────────────────────────────────────────────

router.get("/shio", (_req, res): void => {
  const rows = db.prepare(`SELECT * FROM hk4d_results ORDER BY draw_date DESC LIMIT 60`).all() as Row[];
  if (rows.length === 0) { res.json({ shioStats: [], currentShio: null }); return; }
  const total = rows.length;

  const shioStats = SHIO_DEF.map(s => {
    const nums = s.nums.map(n => String(n).padStart(2, "0"));
    let count = 0, lastIdx = total;
    rows.forEach((row, idx) => {
      if (nums.includes(row.result_2d.padStart(2,"0"))) {
        count++;
        if (lastIdx === total) lastIdx = idx;
      }
    });
    const freqW = count / total;
    const recentW = 1 / (lastIdx + 1);
    const overdueW = (lastIdx + 1) / (total + 1);
    const score = freqW * 0.35 + recentW * 0.3 + overdueW * 0.35;
    return { name: s.name, emoji: s.emoji, count, lastIdx, pct: Math.round(count / total * 100), score, nums };
  }).sort((a, b) => b.score - a.score);

  const cur2D = rows[0]!.result_4d.padStart(4, "0").slice(2);
  res.json({
    currentShio: { ...getShio(cur2D), number: cur2D, date: rows[0]!.draw_date },
    predictedShios: shioStats.slice(0, 3),
    shioStats,
    totalDraws: total,
  });
});

// ─── /api/pola-ikutan ──────────────────────────────────────────────────────

router.get("/pola-ikutan", (_req, res): void => {
  const rows = db.prepare(`SELECT * FROM hk4d_results ORDER BY draw_date DESC LIMIT 60`).all() as Row[];
  if (rows.length < 5) { res.json({ ekorPatterns: [], kepalaPatterns: [] }); return; }

  const ekorTrans: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));
  const kepalaTrans: number[][] = Array.from({ length: 10 }, () => Array(10).fill(0));

  for (let i = 0; i < rows.length - 1; i++) {
    const prev = rows[i + 1]!.result_4d.padStart(4, "0");
    const curr = rows[i]!.result_4d.padStart(4, "0");
    ekorTrans[parseInt(prev[3]!)]![parseInt(curr[3]!)]!++;
    kepalaTrans[parseInt(prev[2]!)]![parseInt(curr[2]!)]!++;
  }

  const lastStr = rows[0]!.result_4d.padStart(4, "0");
  const lastEkor = parseInt(lastStr[3]!);
  const lastKepala = parseInt(lastStr[2]!);

  const mkPatterns = (trans: number[][], from: number) =>
    Array.from({ length: 10 }, (_, d) => ({
      fromDigit: from, toDigit: d,
      count: trans[from]![d]!,
      total: trans[from]!.reduce((s, v) => s + v, 0),
    })).filter(p => p.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);

  res.json({
    lastResult: lastStr,
    lastEkor, lastKepala,
    ekorPatterns: mkPatterns(ekorTrans, lastEkor),
    kepalaPatterns: mkPatterns(kepalaTrans, lastKepala),
    totalPairs: rows.length - 1,
  });
});

// ─── /api/angka-fix ────────────────────────────────────────────────────────

router.get("/angka-fix", (_req, res): void => {
  const rows = db.prepare(`SELECT * FROM hk4d_results ORDER BY draw_date DESC LIMIT 60`).all() as Row[];
  if (rows.length < 5) { res.status(400).json({ error: "Data kurang, tambahkan minimal 5 draw." }); return; }

  const total = rows.length;
  const { posFreq, lastSeen } = buildPosFreq(rows);

  // ── Signals ──
  const { topShios, shio2Ds } = buildShioSignals(rows, total);
  const { goodNextEkors } = buildPolaSignals(rows);

  // ── Positional score ──
  function ps(pos: number, digit: number) {
    const c = posFreq[pos]![digit]!;
    const seen = lastSeen[pos]![digit]!;
    return (c/total)*0.4 + (1/(seen+1))*0.3 + ((seen+1)/(total+1))*0.3;
  }

  // ── 4D/BB Fix via BB-campuran + boosts ──
  const digitScore = (d: number) => [0,1,2,3].reduce((s, p) => s + ps(p, d), 0);
  const top5 = Array.from({length:10},(_,d)=>d).sort((a,b)=>digitScore(b)-digitScore(a)).slice(0,5);
  const excluded4D  = new Set(rows.slice(0,14).map(r=>r.result_4d.padStart(4,"0")));
  // Hindari 3D/2D yang sama dengan hasil N draw terakhir
  const excluded3D_recent = new Set(rows.slice(0,7).map(r=>r.result_4d.padStart(4,"0").slice(1)));
  const excluded2D_recent = new Set(rows.slice(0,5).map(r=>r.result_4d.padStart(4,"0").slice(2)));

  const cands4D: { num: string; score: number }[] = [];
  for (const d0 of top5) for (const d1 of top5) for (const d2 of top5) for (const d3 of top5) {
    const num = `${d0}${d1}${d2}${d3}`;
    if (excluded4D.has(num)) continue;
    // Hindari 3D/2D yang muncul di draw terakhir
    if (excluded3D_recent.has(num.slice(1))) continue;
    if (excluded2D_recent.has(num.slice(2))) continue;
    let score = ps(0,d0)+ps(1,d1)+ps(2,d2)+ps(3,d3);
    if (shio2Ds.has(`${d2}${d3}`)) score *= 1.18;   // shio boost
    if (goodNextEkors.has(d3))      score *= 1.12;   // pola boost
    cands4D.push({ num, score });
  }
  cands4D.sort((a, b) => b.score - a.score);
  const fix4D = cands4D[0]?.num ?? "????";

  // ── 2D Fix (independent from 2D frequency + boosts) ──
  const freq2D = build2dFreq(rows);
  const excluded2D = new Set(rows.slice(0,14).map(r=>r.result_4d.padStart(4,"0").slice(2)));
  const all2D = Object.entries(freq2D)
    .filter(([num]) => !excluded2D.has(num))
    .map(([num, {count,lastIdx}]) => {
      let score = (count/total)*0.4+(1/(lastIdx+1))*0.3+((lastIdx+1)/(total+1))*0.3;
      if (shio2Ds.has(num.padStart(2,"0")))               score *= 1.18;
      if (goodNextEkors.has(parseInt(num[num.length-1]!))) score *= 1.12;
      return { num, score };
    }).sort((a,b)=>b.score-a.score);
  const fix2D = all2D[0]?.num ?? "??";

  // ── 3D Fix ──
  const freq3D = build3dFreq(rows);
  const excluded3D = new Set(rows.slice(0,14).map(r=>r.result_4d.padStart(4,"0").slice(1)));
  const all3D = Object.entries(freq3D)
    .filter(([num]) => !excluded3D.has(num))
    .map(([num,{count,lastIdx}]) => ({
      num,
      score: (count/total)*0.4+(1/(lastIdx+1))*0.3+((lastIdx+1)/(total+1))*0.3,
    })).sort((a,b)=>b.score-a.score);
  // If all3D is empty (all excluded), fall back to best non-excluded 3D from 4D candidates
  const fix3D = all3D[0]?.num ?? fix4D.slice(1);

  const confidence = Math.min(95, Math.round(50 + (total / 60) * 45));

  res.json({
    fix: {
      "4d": { number: fix4D,       shio: getShio(fix4D.slice(2)),  confidence },
      "3d": { number: fix3D,       shio: getShio(fix3D.slice(1)),  confidence: Math.max(40, confidence - 10) },
      "2d": { number: fix2D,       shio: getShio(fix2D),           confidence: Math.min(95, confidence + 5) },
      "bb": { number: fix4D,       shio: getShio(fix4D.slice(2)),  confidence },
    },
    signals: {
      shioBonus: topShios,
      ekorBonus: [...goodNextEkors],
      totalDraws: total,
    },
  });
});

// ─── /api/rekomendasi ──────────────────────────────────────────────────────
// Satu suara: gabungkan semua sinyal → top 10 4D + turunan 3D/2D

router.get("/rekomendasi", (_req, res): void => {
  const rows = db.prepare(`SELECT * FROM hk4d_results ORDER BY draw_date DESC LIMIT 60`).all() as Row[];
  if (rows.length < 5) { res.status(400).json({ error: "Data kurang, tambahkan minimal 5 draw." }); return; }

  const total = rows.length;
  const { posFreq, lastSeen } = buildPosFreq(rows);

  // ── Signals ──
  const { topShios, shio2Ds } = buildShioSignals(rows, total);
  const { goodNextEkors } = buildPolaSignals(rows);

  // ── Positional score ──
  function ps(pos: number, digit: number) {
    const c = posFreq[pos]![digit]!;
    const seen = lastSeen[pos]![digit]!;
    return (c/total)*0.4 + (1/(seen+1))*0.3 + ((seen+1)/(total+1))*0.3;
  }

  // ── Top 5 Angka Kuat ──
  const digitScore = (d: number) => [0,1,2,3].reduce((s, p) => s + ps(p, d), 0);
  const top5 = Array.from({length:10},(_,d)=>d)
    .sort((a,b)=>digitScore(b)-digitScore(a))
    .slice(0,5);

  // ── Generate top 10 4D dari top5 digits (BB-campuran) ──
  const excluded4D  = new Set(rows.slice(0,14).map(r=>r.result_4d.padStart(4,"0")));
  // Hindari 3D/2D yang sama dengan hasil N draw terakhir
  const excluded3D_recent = new Set(rows.slice(0,7).map(r=>r.result_4d.padStart(4,"0").slice(1)));
  const excluded2D_recent = new Set(rows.slice(0,5).map(r=>r.result_4d.padStart(4,"0").slice(2)));

  const cands4D: { num: string; score: number }[] = [];
  for (const d0 of top5) for (const d1 of top5) for (const d2 of top5) for (const d3 of top5) {
    const num = `${d0}${d1}${d2}${d3}`;
    if (excluded4D.has(num)) continue;
    // Hindari 3D/2D yang muncul di draw terakhir
    if (excluded3D_recent.has(num.slice(1))) continue;
    if (excluded2D_recent.has(num.slice(2))) continue;
    let score = ps(0,d0)+ps(1,d1)+ps(2,d2)+ps(3,d3);
    if (shio2Ds.has(`${d2}${d3}`)) score *= 1.18;
    if (goodNextEkors.has(d3))      score *= 1.12;
    cands4D.push({ num, score });
  }
  cands4D.sort((a, b) => b.score - a.score);

  // Ambil top 10 — hindari duplikat 3D/2D agar variatif
  const seen3D = new Set<string>();
  const seen2D = new Set<string>();
  const top10: { rank: number; num4d: string; num3d: string; num2d: string; score: number }[] = [];
  for (const c of cands4D) {
    if (top10.length >= 10) break;
    const n3d = c.num.slice(1);
    const n2d = c.num.slice(2);
    if (seen3D.has(n3d) && seen2D.has(n2d)) continue;
    seen3D.add(n3d);
    seen2D.add(n2d);
    top10.push({ rank: top10.length+1, num4d: c.num, num3d: n3d, num2d: n2d, score: Math.round(c.score*10000)/10000 });
  }

  // Fallback jika kurang dari 10 (data sedikit) — isi dari cands tanpa filter
  if (top10.length < 10) {
    for (const c of cands4D) {
      if (top10.length >= 10) break;
      if (top10.some(t => t.num4d === c.num)) continue;
      const n3d = c.num.slice(1);
      const n2d = c.num.slice(2);
      top10.push({ rank: top10.length+1, num4d: c.num, num3d: n3d, num2d: n2d, score: Math.round(c.score*10000)/10000 });
    }
  }

  const confidence = Math.min(90, Math.round(45 + (total / 60) * 45));
  const basedOnDate = rows[0]!.draw_date;

  // ── Simpan ke rekomendasi_history (upsert by based_on_date) ──
  try {
    const existing = db.prepare(
      `SELECT id FROM rekomendasi_history WHERE based_on_date = ?`
    ).get(basedOnDate) as { id: number } | undefined;

    if (!existing) {
      db.prepare(`
        INSERT INTO rekomendasi_history (based_on_date, angka_kuat, predictions_json, confidence)
        VALUES (?, ?, ?, ?)
      `).run(
        basedOnDate,
        top5.join(","),
        JSON.stringify(top10),
        confidence
      );
    }
  } catch { /* simpan gagal tidak harus stop response */ }

  res.json({
    tanggal: basedOnDate,
    angkaKuat: top5,
    predictions: top10,
    signals: {
      shioBonus: topShios,
      ekorBonus: [...goodNextEkors],
      totalDraws: total,
    },
    confidence,
  });
});

// ─── /api/rekomendasi/winrate ───────────────────────────────────────────────

router.get("/rekomendasi/winrate", (_req, res): void => {
  interface RekRow {
    id: number;
    based_on_date: string;
    angka_kuat: string;
    predictions_json: string;
    confidence: number;
    actual_4d: string | null;
    actual_3d: string | null;
    actual_2d: string | null;
    hit_4d: number;
    hit_3d: number;
    hit_2d: number;
    checked_at: string | null;
    created_at: string;
  }

  const rows = db.prepare(
    `SELECT * FROM rekomendasi_history ORDER BY based_on_date DESC LIMIT 30`
  ).all() as RekRow[];

  const checked = rows.filter(r => r.actual_4d !== null);
  const total = checked.length;
  const hit4d = checked.filter(r => r.hit_4d).length;
  const hit3d = checked.filter(r => r.hit_3d).length;
  const hit2d = checked.filter(r => r.hit_2d).length;

  const history = rows.map(r => {
    let preds: { num4d: string; num3d: string; num2d: string }[] = [];
    try { preds = JSON.parse(r.predictions_json); } catch { preds = []; }
    return {
      based_on_date: r.based_on_date,
      angka_kuat: r.angka_kuat.split(",").map(Number),
      top3_4d: preds.slice(0, 3).map(p => p.num4d),
      actual_4d: r.actual_4d,
      actual_3d: r.actual_3d,
      actual_2d: r.actual_2d,
      hit_4d: r.hit_4d === 1,
      hit_3d: r.hit_3d === 1,
      hit_2d: r.hit_2d === 1,
      checked: r.actual_4d !== null,
    };
  });

  res.json({
    totalChecked: total,
    winrate: {
      "4d": { hits: hit4d, total, pct: total > 0 ? Math.round((hit4d/total)*100) : 0 },
      "3d": { hits: hit3d, total, pct: total > 0 ? Math.round((hit3d/total)*100) : 0 },
      "2d": { hits: hit2d, total, pct: total > 0 ? Math.round((hit2d/total)*100) : 0 },
    },
    history,
  });
});

// ─── /api/accuracy ─────────────────────────────────────────────────────────
// Backtesting: for each draw (starting from draw #8), simulate prediction
// using only prior data, check if actual result was in predicted list.

router.get("/accuracy", (_req, res): void => {
  const allRows = db.prepare(
    `SELECT * FROM hk4d_results ORDER BY draw_date DESC`
  ).all() as Row[];

  const MIN_PRIOR = 7; // need at least 7 prior draws to predict
  if (allRows.length <= MIN_PRIOR) {
    res.json({ enough: false, message: "Tambahkan minimal 8 draw untuk melihat akurasi." });
    return;
  }

  // Helpers (same logic as main endpoints, self-contained for backtesting)
  function simPosFreq(rows: Row[]) {
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

  function posScore(posFreq: number[][], lastSeen: number[][], total: number, pos: number, digit: number) {
    const count = posFreq[pos]![digit]!;
    const seen  = lastSeen[pos]![digit]!;
    const freqW = count / total;
    const recentW = 1 / (seen + 1);
    const overdueW = (seen + 1) / (total + 1);
    return freqW * 0.4 + recentW * 0.3 + overdueW * 0.3;
  }

  // Predict top-N 4D using BB campuran approach
  function predict4D(prior: Row[], topN: number): string[] {
    if (prior.length < 3) return [];
    const total = prior.length;
    const { posFreq, lastSeen } = simPosFreq(prior);
    // Auto-select top 5 digits by combined score
    const digitScore = (d: number) =>
      [0,1,2,3].reduce((sum, p) => sum + posScore(posFreq, lastSeen, total, p, d), 0);
    const top5digits = Array.from({ length: 10 }, (_, d) => d)
      .sort((a, b) => digitScore(b) - digitScore(a))
      .slice(0, 5);
    // Generate all combinations
    const candidates: { num: string; score: number }[] = [];
    for (const d0 of top5digits) for (const d1 of top5digits)
      for (const d2 of top5digits) for (const d3 of top5digits) {
        const num = `${d0}${d1}${d2}${d3}`;
        const score = posScore(posFreq, lastSeen, total, 0, d0) +
                      posScore(posFreq, lastSeen, total, 1, d1) +
                      posScore(posFreq, lastSeen, total, 2, d2) +
                      posScore(posFreq, lastSeen, total, 3, d3);
        candidates.push({ num, score });
      }
    return candidates.sort((a, b) => b.score - a.score).slice(0, topN).map(c => c.num);
  }

  // Predict top-N 3D from frequency
  function predict3D(prior: Row[], topN: number): string[] {
    if (prior.length < 3) return [];
    const total = prior.length;
    const freq: Record<string, { count: number; lastIdx: number }> = {};
    prior.forEach((row, idx) => {
      const k = row.result_3d;
      if (!freq[k]) freq[k] = { count: 0, lastIdx: total };
      freq[k]!.count++;
      if (freq[k]!.lastIdx === total) freq[k]!.lastIdx = idx;
    });
    return Object.entries(freq)
      .map(([num, { count, lastIdx }]) => ({
        num,
        score: (count / total) * 0.4 + (1 / (lastIdx + 1)) * 0.3 + ((lastIdx + 1) / (total + 1)) * 0.3,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map(x => x.num);
  }

  // Predict top-N 2D from frequency
  function predict2D(prior: Row[], topN: number): string[] {
    if (prior.length < 3) return [];
    const total = prior.length;
    const freq: Record<string, { count: number; lastIdx: number }> = {};
    prior.forEach((row, idx) => {
      const k = row.result_2d;
      if (!freq[k]) freq[k] = { count: 0, lastIdx: total };
      freq[k]!.count++;
      if (freq[k]!.lastIdx === total) freq[k]!.lastIdx = idx;
    });
    return Object.entries(freq)
      .map(([num, { count, lastIdx }]) => ({
        num,
        score: (count / total) * 0.4 + (1 / (lastIdx + 1)) * 0.3 + ((lastIdx + 1) / (total + 1)) * 0.3,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map(x => x.num);
  }

  // Run backtesting
  const history: { date: string; actual4d: string; actual3d: string; actual2d: string; hit4d: boolean; hit3d: boolean; hit2d: boolean }[] = [];
  let hits4d = 0, hits3d = 0, hits2d = 0, total = 0;

  for (let i = 0; i < allRows.length - MIN_PRIOR; i++) {
    const testRow = allRows[i]!;
    const prior = allRows.slice(i + 1); // older draws
    const pred4d = predict4D(prior, 10);
    const pred3d = predict3D(prior, 7);
    const pred2d = predict2D(prior, 8);
    const a4d = testRow.result_4d.padStart(4, "0");
    const a3d = a4d.slice(1);
    const a2d = a4d.slice(2);
    const h4d = pred4d.includes(a4d);
    const h3d = pred3d.includes(a3d);
    const h2d = pred2d.includes(a2d);
    if (h4d) hits4d++;
    if (h3d) hits3d++;
    if (h2d) hits2d++;
    total++;
    history.push({ date: testRow.draw_date, actual4d: a4d, actual3d: a3d, actual2d: a2d, hit4d: h4d, hit3d: h3d, hit2d: h2d });
  }

  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;

  res.json({
    enough: true,
    totalTested: total,
    winrate: {
      "4d": { hits: hits4d, total, pct: pct(hits4d) },
      "3d": { hits: hits3d, total, pct: pct(hits3d) },
      "2d": { hits: hits2d, total, pct: pct(hits2d) },
    },
    history: history.slice(0, 20), // last 20 draws
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
