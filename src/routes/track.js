import express from "express";
import {
  listTracks,
  listCategories,
  listExercisesByCategory,
  getExercise
} from "../controllers/track.js";

const router = express.Router();

// list all tracks
router.get("/", listTracks);

// list categories for a track
router.get("/:trackSlug/exercises", listCategories);

// list exercises in a category
router.get("/:trackSlug/exercises/:category", listExercisesByCategory);

// get a specific exercise
router.get("/:trackSlug/exercises/:category/:exerciseSlug", getExercise);

export default router;
