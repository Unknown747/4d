import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cron from "node-cron";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { initDb } from "./db/sqlite.js";
import { syncMarket, initSyncLog } from "./lib/fetcher.js";

initDb();
initSyncLog();

// ── Auto-catch-up on startup (runs 5s after server is ready) ─────────────────
setTimeout(() => {
  logger.info("Startup: catching up SGP + SDY data...");
  Promise.allSettled([
    syncMarket("sgp").then(r => logger.info({ added: r.added, skipped: r.skipped }, "Startup SGP sync done")),
    syncMarket("sdy").then(r => logger.info({ added: r.added, skipped: r.skipped }, "Startup SDY sync done")),
  ]).catch((err) => logger.warn({ err: String(err) }, "Startup sync error"));
}, 5_000);

// ── Cron: SGP draws on Sun(0) Mon(1) Wed(3) Thu(4) Sat(6) at 23:05 WIB (UTC+7) ─
// 23:05 WIB = 16:05 UTC
cron.schedule("5 16 * * 0,1,3,4,6", async () => {
  logger.info("Cron: auto-sync SGP");
  try { await syncMarket("sgp"); } catch (err) { logger.error({ err }, "Cron SGP error"); }
});

// ── Cron: SDY draws every day at 23:05 WIB ────────────────────────────────────
cron.schedule("5 16 * * *", async () => {
  logger.info("Cron: auto-sync SDY");
  try { await syncMarket("sdy"); } catch (err) { logger.error({ err }, "Cron SDY error"); }
});

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;
