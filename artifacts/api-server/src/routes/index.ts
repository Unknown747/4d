import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import resultsRouter from "./results.js";
import predictionRouter from "./prediction.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(resultsRouter);
router.use(predictionRouter);

export default router;
