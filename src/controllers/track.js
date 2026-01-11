import {
  getAllTracks,
  getTrackCategories,
  getExercisesInCategory,
  getExerciseData
} from "../utils/exerciseData.js";
import UserProgress from "../models/UserProgress.js";
import { protect } from "../middlewares/auth.js";

// GET /api/tracks  → return all tracks with exercise counts
export const listTracks = (req, res, next) => {
  try {
    const tracks = getAllTracks();
    const tracksWithCount = tracks.map(slug => {
      const categories = getTrackCategories(slug);
      let exerciseCount = 0;
      categories.forEach(cat => {
        exerciseCount += getExercisesInCategory(slug, cat).length;
      });
      return { slug, exerciseCount };
    });
    res.status(200).json({ tracks: tracksWithCount });
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

// POST /api/tracks/:trackSlug/join - Join a track
export const joinTrack = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { trackSlug } = req.params;

    // Check if user already has any progress in this track
    const existingProgress = await UserProgress.findOne({
      user: userId,
      trackSlug: trackSlug
    });

    if (existingProgress) {
      return res.status(200).json({ 
        success: true,
        message: "Already joined this track",
        trackSlug 
      });
    }

    // Create initial progress entry to mark track as "joined"
    await UserProgress.create({
      user: userId,
      trackSlug: trackSlug,
      exerciseSlug: "_joined",  // Special marker for "joined but no exercise started"
      category: "system",
      status: "in_progress"
    });

    res.status(200).json({ 
      success: true,
      message: "Track joined successfully",
      trackSlug 
    });
  } catch (err) {
    next(err);
  }
};
