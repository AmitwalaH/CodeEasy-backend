import express from "express";
// import {
//   listTracks,
//   listCategories,
//   listExercisesByCategory,
//   getExercise,
//   joinTrack,
//   getTrackConfig,
//   getTrackAbout,
// } from "../controllers/trackController.js";
// import { getConceptDetail } from "../controllers/conceptController.js";
// import { protect } from "../middlewares/auth.js";

const router = express.Router();

// // list all tracks
// router.get("/", listTracks);

// // join a track (auth required)
// router.post("/:trackSlug/join", protect, joinTrack);

// // list categories for a track
// router.get("/:trackSlug/exercises", listCategories);

// // list exercises in a category
// router.get("/:trackSlug/exercises/:category", listExercisesByCategory);

// // get a specific exercise
// router.get("/:trackSlug/exercises/:category/:exerciseSlug", getExercise);

// // get track about information
// router.get("/:trackSlug/about", getTrackAbout);

// // get track configuration
// router.get("/:trackSlug/config", getTrackConfig);

// // get concept detail
// router.get("/:trackSlug/concepts/:conceptSlug", getConceptDetail);

// const router = require("express").Router();
import * as trackController from "../controllers/trackController.js";
import * as exerciseController from "../controllers/exerciseController.js";
import * as conceptController from "../controllers/conceptController.js";

// GET /api/tracks - List all tracks
router.get("/", trackController.getAllTracks);

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

// module.exports = router;

export default router;
