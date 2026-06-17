import { Router } from "express";
import { syncResults, getSyncStatus } from "../lib/fetcher.js";

const router = Router();

router.get("/sync/status", (_req, res): void => {
  try {
    const status = getSyncStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/sync/run", async (_req, res): Promise<void> => {
  try {
    const result = await syncResults();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
