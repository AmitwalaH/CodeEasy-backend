import express from "express";
import {
  markCompleted,
  getMyProgress,
  joinTrack,
  startExercise,
} from "../controllers/progress.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

router.post("/tracks/:slug/join", protect, joinTrack);

router.post("/start", protect, startExercise);

router.post("/complete", protect, markCompleted);

router.get("/my-progress", protect, getMyProgress);

export default router;
