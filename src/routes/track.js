import express from "express";
import {
  listTracks,
  listCategories,
  listExercisesByCategory,
  getExercise,
  joinTrack  // ADD THIS
} from "../controllers/track.js";
import { protect } from "../middlewares/auth.js";  // ADD THIS

const router = express.Router();

// list all tracks
router.get("/", listTracks);

// JOIN a track (requires auth)
router.post("/:trackSlug/join", protect, joinTrack);  // ADD THIS LINE

// GET /api/tracks/:trackSlug/concepts/:conceptSlug
router.get("/:trackSlug/concepts/:conceptSlug", getConceptDetail);

// list categories for a track
router.get("/:trackSlug/exercises", listCategories);

// list exercises in a category
router.get("/:trackSlug/exercises/:category", listExercisesByCategory);

// get a specific exercise
router.get("/:trackSlug/exercises/:category/:exerciseSlug", getExercise);

export default router;
