import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import resultsRouter from "./results.js";
import predictionRouter from "./prediction.js";
import syncRouter from "./sync.js";
import geminiRouter from "./gemini.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(resultsRouter);
router.use(predictionRouter);
router.use(syncRouter);
router.use("/gemini", geminiRouter);

export default router;
