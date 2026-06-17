---
name: HK Toto Pro Architecture
description: Key schema and derivation rules for the HK 4D prediction app.
---

## DB Schema
Table: `hk4d_results` (NOT `results` — old Mark Six table removed)
Columns: id, draw_date (UNIQUE), result_4d (padded 4-char string), result_3d, result_2d, source, created_at

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
- Vanilla HTML/CSS/JS at artifacts/hk-frontend (Vite, port 18654)
- Mobile: bottom nav bar (fixed), 2-col grid, large touch targets
- Desktop: sticky top navbar with tabs
- API at /api → port 8080 (Express, artifacts/api-server)
