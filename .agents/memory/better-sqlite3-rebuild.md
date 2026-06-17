---
name: better-sqlite3 native rebuild
description: Binary ABI mismatch fix and deferred index strategy for market-column migration
---

## Rule — functional load test, not file-exists
`ensure-native.mjs` must do a **functional load test** (`try { createRequire()(BINARY) }`) rather than `existsSync()`. If the load throws, rebuild. A stale binary (compiled for wrong V8) passes the file-exists check but crashes at runtime with `undefined symbol: _ZN2v812api_internal33ConvertToJSGlobalProxyIfNecessaryEm`.

**Why:** After environment reset Node.js may upgrade; the old `.node` binary stays on disk but is linked to the old V8 ABI. `existsSync` returns true but `dlopen` fails.

**How to apply:** Script at `artifacts/api-server/scripts/ensure-native.mjs` — always runs before `pnpm run build` in the `dev` script.

## Rule — `CREATE INDEX` on new columns must come after migration
`CREATE INDEX` statements that reference a `market` column must be placed **after** `runMigrations()` completes, wrapped in `try/catch`. Never put them in the initial `db.exec()` block alongside `CREATE TABLE IF NOT EXISTS`.

**Why:** On an existing (pre-rebrand) database, `CREATE TABLE IF NOT EXISTS` is a no-op (table exists without the `market` column), so any `CREATE INDEX … ON table(market, …)` in the same exec block throws `SqliteError: no such column: market` before migration can run.

**How to apply:** In `artifacts/api-server/src/db/sqlite.ts`, `initDb()` only creates tables; all `CREATE INDEX` for market are at the bottom of `runMigrations()` inside `try { } catch {}`.

## Required SQLite compile defines
All from `deps/defines.gypi` including `SQLITE_ENABLE_COLUMN_METADATA` (critical — missing this causes `undefined symbol: sqlite3_column_origin_name` at runtime).
