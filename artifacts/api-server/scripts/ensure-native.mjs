import { existsSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = resolve(__dirname, '../../..');
const BSQ = join(ROOT, 'node_modules/.pnpm/better-sqlite3@12.11.1/node_modules/better-sqlite3');
const BINARY = join(BSQ, 'build/Release/better_sqlite3.node');

if (existsSync(BINARY)) {
  console.log('[native] better-sqlite3 binary OK');
  process.exit(0);
}

console.log('[native] better-sqlite3 binary missing — rebuilding from source...');

const NODE_INC = execSync('node -e "process.stdout.write(require(\'path\').join(process.execPath, \'../../include/node\'))"').toString().trim();

const DEFINES = [
  'HAVE_INT16_T=1','HAVE_INT32_T=1','HAVE_INT8_T=1','HAVE_STDINT_H=1',
  'HAVE_UINT16_T=1','HAVE_UINT32_T=1','HAVE_UINT8_T=1','HAVE_USLEEP=1',
  'SQLITE_DEFAULT_CACHE_SIZE=-16000','SQLITE_DEFAULT_FOREIGN_KEYS=1',
  'SQLITE_DEFAULT_MEMSTATUS=0','SQLITE_DEFAULT_WAL_SYNCHRONOUS=1',
  'SQLITE_DQS=0','SQLITE_ENABLE_COLUMN_METADATA','SQLITE_ENABLE_DBSTAT_VTAB',
  'SQLITE_ENABLE_DESERIALIZE','SQLITE_ENABLE_FTS3','SQLITE_ENABLE_FTS3_PARENTHESIS',
  'SQLITE_ENABLE_FTS4','SQLITE_ENABLE_FTS5','SQLITE_ENABLE_GEOPOLY',
  'SQLITE_ENABLE_JSON1','SQLITE_ENABLE_MATH_FUNCTIONS','SQLITE_ENABLE_PERCENTILE',
  'SQLITE_ENABLE_RTREE','SQLITE_ENABLE_STAT4','SQLITE_ENABLE_UPDATE_DELETE_LIMIT',
  'SQLITE_LIKE_DOESNT_MATCH_BLOBS','SQLITE_OMIT_DEPRECATED',
  'SQLITE_OMIT_PROGRESS_CALLBACK','SQLITE_OMIT_SHARED_CACHE',
  'SQLITE_OMIT_TCL_VARIABLE','SQLITE_SOUNDEX','SQLITE_THREADSAFE=2',
  'SQLITE_TRACE_SIZE_LIMIT=32','SQLITE_USE_URI=0',
].map(d => `-D${d}`).join(' ');

const OBJ_SQLITE = join(BSQ, 'build/Release/obj.target/sqlite3/deps/sqlite3');
const OBJ_BSQ   = join(BSQ, 'build/Release/obj.target/better_sqlite3/src');
mkdirSync(OBJ_SQLITE, { recursive: true });
mkdirSync(OBJ_BSQ,    { recursive: true });

const SRC_SQLITE = join(BSQ, 'deps/sqlite3/sqlite3.c');
const OBJ_SQLITE_O = join(OBJ_SQLITE, 'sqlite3.o');
const SQLITE_A   = join(BSQ, 'build/Release/sqlite3.a');
const SRC_BSQ    = join(BSQ, 'src/better_sqlite3.cpp');
const OBJ_BSQ_O  = join(OBJ_BSQ, 'better_sqlite3.o');

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

run(`gcc -O2 -fPIC ${DEFINES} -c ${SRC_SQLITE} -o ${OBJ_SQLITE_O}`);
run(`ar rcs ${SQLITE_A} ${OBJ_SQLITE_O}`);
run(`g++ -O2 -fPIC -std=c++20 -I${join(BSQ,'src')} -I${join(BSQ,'deps/sqlite3')} -I${NODE_INC} -DNODE_GYP_MODULE_NAME=better_sqlite3 -DUSING_UV_SHARED=1 -DUSING_V8_SHARED=1 ${DEFINES} -c ${SRC_BSQ} -o ${OBJ_BSQ_O}`);
run(`g++ -shared -Wl,-soname=better_sqlite3.node -Wl,--strip-all -fPIC -o ${BINARY} ${OBJ_BSQ_O} ${SQLITE_A} -lpthread -ldl`);

console.log('[native] better-sqlite3 rebuilt successfully ✓');
