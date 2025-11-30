import express from "express";
import { markCompleted, getMyProgress } from "../controllers/progress.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

router.post("/complete", protect, markCompleted);
router.get("/my-progress", protect, getMyProgress);

export default router;
