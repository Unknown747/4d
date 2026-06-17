import express, { type Express } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import pinoHttp from "pino-http";
import cron from "node-cron";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";
import { initDb } from "./db/sqlite.js";
import { syncResults, initSyncLog } from "./lib/fetcher.js";

initDb();
initSyncLog();

// Auto-sync every 6 hours
cron.schedule("0 */6 * * *", async () => {
  logger.info("Cron: starting scheduled HK sync");
  const result = await syncResults();
  logger.info({ added: result.added, skipped: result.skipped }, "Cron: sync done");
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const publicDir = path.resolve(__dirname, "../public");
app.use(express.static(publicDir));

app.use("/api", router);

app.get("/", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

export default app;
