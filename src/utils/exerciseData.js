import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

/** 
 * Return array of all track slugs (top-level folders under data/)
 */
export function getAllTracks() {
  if (!fs.existsSync(DATA_DIR)) {
    return [];
  }
  return fs.readdirSync(DATA_DIR, { withFileTypes: true })
           .filter(dirent => dirent.isDirectory())
           .map(dirent => dirent.name);
}

/**
 * Get list of categories (sub-folder names) for a track
 * e.g. ["concept","practice"]
 */
export function getTrackCategories(trackSlug) {
  const trackDir = path.join(DATA_DIR, trackSlug);
  if (!fs.existsSync(trackDir)) throw new Error("Track not found");
  return fs
    .readdirSync(trackDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
}

/**
 * Given trackSlug and category (folder), return list of exercise slugs (JSON file names)
 */
export function getExercisesInCategory(trackSlug, category) {
  const catDir = path.join(DATA_DIR, trackSlug, category);
  if (!fs.existsSync(catDir)) {
    throw new Error("Category not found");
  }
  return fs
    .readdirSync(catDir, { withFileTypes: true })
    .filter(dirent => dirent.isFile() && dirent.name.endsWith(".json"))
    .map(dirent => path.basename(dirent.name, ".json"));
}

/**
 * Given trackSlug, category, and exerciseSlug, return parsed JSON object
 */
export function getExerciseData(trackSlug, category, exerciseSlug) {
  const filePath = path.join(DATA_DIR, trackSlug, category, `${exerciseSlug}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error("Exercise not found");
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}
