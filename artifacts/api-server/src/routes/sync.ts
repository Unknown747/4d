import { Router } from "express";
import { syncMarket, syncAll, getSyncStatus, type Market } from "../lib/fetcher.js";

const router = Router();

router.get("/sync/status", (_req, res): void => {
  try {
    const status = getSyncStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/sync/run", async (req, res): Promise<void> => {
  try {
    const market = req.query["market"] as string | undefined;
    if (market === "sgp" || market === "sdy") {
      const result = await syncMarket(market as Market);
      res.json({ [market]: result });
    } else {
      const result = await syncAll();
      res.json(result);
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
