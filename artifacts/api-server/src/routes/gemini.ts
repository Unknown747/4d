import { Router } from "express";
import { db } from "../db/sqlite.js";

const router = Router();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

interface Row {
  id: number;
  draw_date: string;
  result_4d: string;
  result_3d: string;
  result_2d: string;
  source: string;
}

async function callGemini(prompt: string, timeoutMs = 20_000): Promise<string> {
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY tidak ditemukan");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
      }),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Gemini API error ${resp.status}: ${err}`);
    }

    const data = await resp.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } finally {
    clearTimeout(timer);
  }
}

// ─── POST /api/gemini/validate ──────────────────────────────────────────────
router.post("/validate", async (req, res): Promise<void> => {
  const { angka } = req.body as { angka?: string };
  if (!angka) { res.status(400).json({ error: "Field 'angka' wajib diisi" }); return; }

  const rows = db.prepare(
    `SELECT * FROM hk4d_results ORDER BY draw_date DESC LIMIT 30`
  ).all() as Row[];

  const historyStr = rows.slice(0, 15).map(r => `${r.draw_date}: 4D=${r.result_4d} 3D=${r.result_3d} 2D=${r.result_2d}`).join("\n");

  const prompt = `Kamu adalah analis prediksi togel HK 4D profesional.
Data 15 draw terakhir:
${historyStr}

Angka yang ingin divalidasi: ${angka}
Tipe angka: ${angka.length === 4 ? "4D" : angka.length === 3 ? "3D" : "2D"}

Analisis angka ini berdasarkan:
1. Frekuensi kemunculan dalam data
2. Pola digit per posisi
3. Jarak dari kemunculan terakhir
4. Hot/cold status
5. Kemungkinan muncul di draw berikutnya (skala 0-100)

Balas dalam format JSON SAJA tanpa markdown:
{"score": <0-100>, "status": "<KUAT|SEDANG|LEMAH>", "reason": "<alasan singkat dalam bahasa Indonesia>", "suggestion": "<saran singkat>"}`;

  try {
    const raw = await callGemini(prompt);
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = { score: 50, status: "SEDANG", reason: raw.slice(0, 200), suggestion: "" };
    }

    // Save to validations table
    try {
      const p = parsed as { score?: number; status?: string; reason?: string };
      db.prepare(
        `INSERT OR IGNORE INTO validations (angka, status, score, reason, created_at)
         VALUES (?, ?, ?, ?, datetime('now'))`
      ).run(angka, p.status ?? "SEDANG", p.score ?? 50, p.reason ?? "");
    } catch { /* ignore */ }

    res.json({ angka, result: parsed });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/gemini/predict ───────────────────────────────────────────────
router.post("/predict", async (req, res): Promise<void> => {
  const { type = "2d", context = "" } = req.body as { type?: string; context?: string };

  const rows = db.prepare(
    `SELECT * FROM hk4d_results ORDER BY draw_date DESC LIMIT 50`
  ).all() as Row[];

  if (rows.length < 5) { res.status(400).json({ error: "Data kurang, minimal 5 draw" }); return; }

  const historyStr = rows.slice(0, 20).map(r => `${r.draw_date}: 4D=${r.result_4d} 3D=${r.result_3d} 2D=${r.result_2d}`).join("\n");

  const typeLabel = type === "4d" ? "4 angka (4D)" : type === "3d" ? "3 angka (3D)" : "2 angka (2D)";
  const count = type === "4d" ? 2 : 3;

  const prompt = `Kamu adalah analis togel HK 4D profesional dengan pengalaman 20 tahun.
Data ${rows.length} draw terakhir:
${historyStr}

${context ? `Konteks tambahan dari user: ${context}` : ""}

Tugasmu: Prediksi ${count} angka ${typeLabel} yang paling mungkin keluar pada draw berikutnya.

Analisis berdasarkan:
1. Pola frekuensi digit per posisi
2. Angka yang sudah lama tidak muncul (overdue)
3. Tren 5-10 draw terakhir
4. Kemungkinan berdasarkan distribusi statistik

Balas dalam format JSON SAJA tanpa markdown:
{
  "predictions": [
    {"number": "<angka>", "score": <0-100>, "reason": "<alasan singkat>"},
    ...
  ],
  "analysis": "<ringkasan analisis singkat dalam 2-3 kalimat>",
  "method": "Gemini AI Analysis"
}`;

  try {
    const raw = await callGemini(prompt);
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(clean);
    } catch {
      parsed = { predictions: [], analysis: raw.slice(0, 300), method: "Gemini AI Analysis" };
    }

    // Save predictions to DB
    try {
      const p = parsed as { predictions?: { number?: string }[] };
      const preds = p.predictions ?? [];
      if (preds.length > 0) {
        const insertPred = db.prepare(
          `INSERT INTO predictions (date, pred_type, angka, method, score, reason, created_at)
           VALUES (date('now'), ?, ?, 'gemini', ?, ?, datetime('now'))`
        );
        for (const pred of preds.slice(0, 3)) {
          const pr = pred as { number?: string; score?: number; reason?: string };
          insertPred.run(type, pr.number ?? "", pr.score ?? 50, pr.reason ?? "");
        }
      }
    } catch { /* ignore if table not ready */ }

    res.json({ type, result: parsed });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── POST /api/gemini/chat ──────────────────────────────────────────────────
router.post("/chat", async (req, res): Promise<void> => {
  const { message, history = [] } = req.body as { message?: string; history?: { role: string; text: string }[] };
  if (!message) { res.status(400).json({ error: "Field 'message' wajib diisi" }); return; }

  const rows = db.prepare(
    `SELECT * FROM hk4d_results ORDER BY draw_date DESC LIMIT 10`
  ).all() as Row[];

  const latestStr = rows.slice(0, 5).map(r => `${r.draw_date}: ${r.result_4d}`).join(", ");

  const historyCtx = history.slice(-6).map(h => `${h.role === "user" ? "User" : "Asisten"}: ${h.text}`).join("\n");

  const prompt = `Kamu adalah asisten prediksi togel HK 4D bernama "HK Pro AI". 
Data draw terbaru: ${latestStr}
Total data: ${rows.length} draw

${historyCtx ? `Riwayat percakapan:\n${historyCtx}\n` : ""}User: ${message}

Jawab dengan ramah, profesional, dan informatif dalam bahasa Indonesia. 
Jika ditanya prediksi, berikan analisis berdasarkan data. 
Jika ditanya hal lain terkait togel/angka, jawab dengan bijak.
Asisten:`;

  try {
    const reply = await callGemini(prompt);
    res.json({ reply: reply.trim(), timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// ─── GET /api/gemini/history ─────────────────────────────────────────────────
router.get("/history", (_req, res): void => {
  try {
    const preds = db.prepare(
      `SELECT * FROM predictions ORDER BY created_at DESC LIMIT 20`
    ).all();
    const validations = db.prepare(
      `SELECT * FROM validations ORDER BY created_at DESC LIMIT 20`
    ).all();
    res.json({ predictions: preds, validations });
  } catch {
    res.json({ predictions: [], validations: [] });
  }
});

export default router;
