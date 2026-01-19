import express from "express";
import {
  listTracks,
  listCategories,
  listExercisesByCategory,
  getExercise,
  joinTrack,
  getTrackConfig,
  getTrackAbout,
} from "../controllers/track.js";
import { getConceptDetail } from "../controllers/conceptController.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

// list all tracks
router.get("/", listTracks);

// join a track (auth required)
router.post("/:trackSlug/join", protect, joinTrack);

// list categories for a track
router.get("/:trackSlug/exercises", listCategories);

// list exercises in a category
router.get("/:trackSlug/exercises/:category", listExercisesByCategory);

// get a specific exercise
router.get("/:trackSlug/exercises/:category/:exerciseSlug", getExercise);

// get track about information
router.get("/:trackSlug/about", getTrackAbout);

// get track configuration
router.get("/:trackSlug/config", getTrackConfig);

// get concept detail
router.get("/:trackSlug/concepts/:conceptSlug", getConceptDetail);

export default router;
