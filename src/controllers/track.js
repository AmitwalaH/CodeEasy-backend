import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  getAllTracks,
  getTrackCategories,
  getExercisesInCategory,
  getExerciseData,
} from "../utils/exerciseData.js";

import UserProgress from "../models/UserProgress.js";

// --------------------------------------------------
// ESM __dirname FIX
// --------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --------------------------------------------------
// DATA PATH
// src/controllers → ../../data
// --------------------------------------------------
const DATA_PATH = path.join(__dirname, "../../data");

// --------------------------------------------------
// GET /api/tracks
// --------------------------------------------------
export const listTracks = (req, res, next) => {
  try {
    const tracks = getAllTracks();

    const tracksWithCount = tracks.map((slug) => {
      const categories = getTrackCategories(slug);
      let exerciseCount = 0;

      categories.forEach((cat) => {
        exerciseCount += getExercisesInCategory(slug, cat).length;
      });

      return { slug, exerciseCount };
    });

    res.status(200).json({ tracks: tracksWithCount });
  } catch (err) {
    next(err);
  }
};

// --------------------------------------------------
// GET /api/tracks/:trackSlug/exercises
// --------------------------------------------------
export const listCategories = (req, res, next) => {
  try {
    const { trackSlug } = req.params;
    const categories = getTrackCategories(trackSlug);

    res.status(200).json({
      track: trackSlug,
      categories,
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

// --------------------------------------------------
// GET /api/tracks/:trackSlug/exercises/:category
// --------------------------------------------------
export const listExercisesByCategory = (req, res, next) => {
  try {
    const { trackSlug, category } = req.params;
    const exercises = getExercisesInCategory(trackSlug, category);

    res.status(200).json({
      track: trackSlug,
      category,
      exercises,
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

// --------------------------------------------------
// GET /api/tracks/:trackSlug/exercises/:category/:exerciseSlug
// --------------------------------------------------
export const getExercise = (req, res, next) => {
  try {
    const { trackSlug, category, exerciseSlug } = req.params;
    const exercise = getExerciseData(trackSlug, category, exerciseSlug);

    res.status(200).json({
      track: trackSlug,
      category,
      exercise,
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
};

// --------------------------------------------------
// POST /api/tracks/:trackSlug/join
// --------------------------------------------------
export const joinTrack = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { trackSlug } = req.params;

    const existingProgress = await UserProgress.findOne({
      user: userId,
      trackSlug,
    });

    if (existingProgress) {
      return res.status(200).json({
        success: true,
        message: "Already joined this track",
        trackSlug,
      });
    }

    await UserProgress.create({
      user: userId,
      trackSlug,
      exerciseSlug: "_joined",
      category: "system",
      status: "in_progress",
    });

    res.status(200).json({
      success: true,
      message: "Track joined successfully",
      trackSlug,
    });
  } catch (err) {
    next(err);
  }
};

// --------------------------------------------------
// GET /api/tracks/:trackSlug/config
// --------------------------------------------------
export const getTrackConfig = (req, res, next) => {
  try {
    const { trackSlug } = req.params;
    const configPath = path.join(DATA_PATH, trackSlug, "config.json");

    if (!fs.existsSync(configPath)) {
      return res.status(404).json({ error: "Config not found" });
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    res.status(200).json({
      track: trackSlug,
      config: {
        name: config.language,
        slug: config.slug,
        blurb: config.blurb,
        exerciseCount:
          (config.exercises?.concept?.length || 0) +
          (config.exercises?.practice?.length || 0),
        concepts: config.concepts || [],
        ...config,
      },
    });
  } catch (err) {
    next(err);
  }
};

// --------------------------------------------------
// GET /api/tracks/:trackSlug/about
// --------------------------------------------------
export const getTrackAbout = (req, res, next) => {
  try {
    const { trackSlug } = req.params;
    const aboutPath = path.join(DATA_PATH, trackSlug, "ABOUT.md");

    if (!fs.existsSync(aboutPath)) {
      return res.status(404).json({ error: "About not found" });
    }

    const about = fs.readFileSync(aboutPath, "utf8");

    res.status(200).json({
      track: trackSlug,
      about,
    });
  } catch (err) {
    next(err);
  }
};
// --------------------------------------------------
// GET /api/tracks/:trackSlug/concepts/:conceptSlug
// --------------------------------------------------
export const getConceptDetail = (req, res, next) => {
  try {
    const { trackSlug, conceptSlug } = req.params;

    const conceptFilePath = path.join(
      DATA_PATH,
      trackSlug,
      "concepts",
      `${conceptSlug}.json`
    );

    if (!fs.existsSync(conceptFilePath)) {
      return res.status(404).json({
        success: false,
        message: "Concept not found",
      });
    }

    const concept = JSON.parse(fs.readFileSync(conceptFilePath, "utf8"));

    res.json({
      success: true,
      data: {
        about: concept?.about ?? concept?.docs?.about ?? "",

        // introduction:
        //   concept?.introduction ?? concept?.docs?.introduction ?? "",

        links: concept?.links ?? [],
        config: concept?.config ?? {},
      },
    });
  } catch (err) {
    next(err);
  }
};
