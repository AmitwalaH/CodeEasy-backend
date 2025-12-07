// src/controllers/track.controller.js
import {
  getAllTracks,
  getTrackCategories,
  getExercisesInCategory,
  getExerciseData
} from "../utils/exerciseData.js";

export const listTracks = (req, res, next) => {
  try {
    const tracks = getAllTracks();
    res.status(200).json({ tracks });
  } catch (err) {
    next(err);
  }
};

// GET /api/tracks/:trackSlug/exercises  → return categories under track
export const listCategories = (req, res, next) => {
  try {
    const { trackSlug } = req.params;
    const categories = getTrackCategories(trackSlug);
    res.status(200).json({ track: trackSlug, categories });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

// GET /api/tracks/:trackSlug/exercises/:category → return exercise slugs under that category
export const listExercisesByCategory = (req, res, next) => {
  try {
    const { trackSlug, category } = req.params;
    const exercises = getExercisesInCategory(trackSlug, category);
    res.status(200).json({ track: trackSlug, category, exercises });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

// GET /api/tracks/:trackSlug/exercises/:category/:exerciseSlug → return full exercise data
export const getExercise = (req, res, next) => {
  try {
    const { trackSlug, category, exerciseSlug } = req.params;
    const exercise = getExerciseData(trackSlug, category, exerciseSlug);
    res.status(200).json({ track: trackSlug, category, exercise });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};
