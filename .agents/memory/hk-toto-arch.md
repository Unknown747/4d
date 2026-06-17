---
name: HK Toto Pro Architecture
description: Key schema and derivation rules for the HK 4D prediction app.
---

## DB Schema
Table: `hk4d_results` (NOT `results` — old Mark Six table removed)
Columns: id, draw_date (UNIQUE), result_4d (padded 4-char string), result_3d, result_2d, source, created_at

Table: `predictions` — id, date, pred_type, angka, method, score, reason, created_at

Table: `validations` — id, angka, status, score, reason, created_at

## Derivation Rule
- result_4d stored as padded 4-char string e.g. "1064", "0365"
- result_3d = result_4d.slice(1)  → last 3 digits
- result_2d = result_4d.slice(2)  → last 2 digits
- AS = slice(0,2), KOP = slice(1,3), KEPALA = [2], EKOR = [3]

**Why:** Indonesian lottery terminology for HK 4D. All derived on insert, stored for query efficiency.

## Prediction Engine
- Positional digit analysis: 4 positions × 10 digits = freq + lastSeen matrix
- 2D/3D frequency tracked separately
- Modes: hot (recency-weighted), cold (overdue-weighted), balanced

## Seed Data
28 real draws May–June 2026 from screenshot, seeded in sqlite.ts seedData().
Source = 'seed'. Manual entries source = 'manual'. Auto-sync is disabled (no public HK 4D API found).

## Frontend
- React Vite app at artifacts/hk-frontend (port 18654), index.html must be simple Vite entry (just <div id="root"> + <script type="module" src="/src/main.tsx">)
- Old vanilla HTML was replaced — index.html previously was full vanilla app causing old UI to be served
- Tabs: Dashboard, Prediksi (statistik+gemini+kombinasi), Paito (color grid), AI Chat (Gemini), Angka Fix, Shio, Pola, Akurasi, History
- API at /api → port 8080 (Express, artifacts/api-server)

## Gemini Integration
- Uses user's own GEMINI_API_KEY (env secret) — Replit AI integration requires upgrade
- Endpoint: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent
- Routes: POST /api/gemini/validate, POST /api/gemini/predict, POST /api/gemini/chat, GET /api/gemini/history
- gemini.ts in artifacts/api-server/src/routes/

## Native Build (better-sqlite3)
- Needs Python3 + gcc to compile native .node binding
- Python3 must be installed via installSystemDependencies
- After Python install: configure with node-gyp from pnpm store, then `make -C build` in better-sqlite3 dir
- The build takes ~60-90s to compile SQLite from source
