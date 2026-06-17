---
name: better-sqlite3 native rebuild
description: The better-sqlite3.node binary disappears after Replit env resets and must be compiled from source manually with all required SQLite defines.
---

## Rule
After every environment reset, better-sqlite3.node must be compiled from source. `npm rebuild` and `pnpm rebuild` report success but do NOT produce the binary in this environment.

**Why:** Replit's ephemeral container wipes compiled .node binaries on reset. The pnpm store has source files but the prebuilt binary is not retained.

**How to apply:**
- The API server's `dev` script now calls `node scripts/ensure-native.mjs` before build — this auto-compiles if binary is missing.
- The script path: `artifacts/api-server/scripts/ensure-native.mjs`
- It checks `build/Release/better_sqlite3.node`, and if absent, compiles sqlite3.c → sqlite3.a, then better_sqlite3.cpp → better_sqlite3.o, then links to .node.

## Required SQLite compile defines
All from `deps/defines.gypi` including `SQLITE_ENABLE_COLUMN_METADATA` (critical — missing this causes `undefined symbol: sqlite3_column_origin_name` at runtime).

## Manual rebuild command (fallback)
```bash
BSQ=/home/runner/workspace/node_modules/.pnpm/better-sqlite3@12.11.1/node_modules/better-sqlite3
NODE_INC=/nix/store/jfar9wnj6kvr0gr6klh1gk7vgckkfr5j-nodejs-20.20.0/include/node
DEFINES="-DSQLITE_ENABLE_COLUMN_METADATA -DSQLITE_THREADSAFE=2 ... (see defines.gypi)"
mkdir -p $BSQ/build/Release/obj.target/{sqlite3/deps/sqlite3,better_sqlite3/src}
gcc -O2 -fPIC $DEFINES -c $BSQ/deps/sqlite3/sqlite3.c -o .../sqlite3.o
ar rcs $BSQ/build/Release/sqlite3.a .../sqlite3.o
g++ -O2 -fPIC -std=c++20 -I... -c $BSQ/src/better_sqlite3.cpp -o .../better_sqlite3.o
g++ -shared -Wl,--strip-all -fPIC -o $BSQ/build/Release/better_sqlite3.node .../better_sqlite3.o sqlite3.a -lpthread -ldl
```
