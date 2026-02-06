import express from "express";

import * as trackController from "../controllers/trackController.js";
import * as exerciseController from "../controllers/exerciseController.js";
import * as conceptController from "../controllers/conceptController.js";

import { protect } from "../middlewares/auth.js";
import { joinTrack } from "../controllers/progress.js";

const router = express.Router();

// POST /api/tracks/:trackSlug/join
router.post("/:trackSlug/join", protect, joinTrack);

// GET /api/tracks - List all tracks
router.get("/", trackController.getAllTracks);

// GET /api/tracks/:slug  (single track details + studentCount)
router.get("/:slug", trackController.getTrackBySlug);

// GET /api/tracks/:trackSlug/about
router.get("/:trackSlug/about", trackController.getTrackAbout);

// GET /api/tracks/:trackSlug/config
router.get("/:trackSlug/config", trackController.getTrackConfig);

// GET /api/tracks/:trackSlug/exercises
router.get("/:trackSlug/exercises", exerciseController.getCategories);

// GET /api/tracks/:trackSlug/exercises/:category
router.get(
  "/:trackSlug/exercises/:category",
  exerciseController.getExerciseSlugs,
);

// GET /api/tracks/:trackSlug/exercises/:category/:exerciseSlug
router.get(
  "/:trackSlug/exercises/:category/:exerciseSlug",
  exerciseController.getExerciseDetail,
);

// GET /api/tracks/:trackSlug/concepts/:conceptSlug
router.get(
  "/:trackSlug/concepts/:conceptSlug",
  conceptController.getConceptDetail,
);

export default router;
