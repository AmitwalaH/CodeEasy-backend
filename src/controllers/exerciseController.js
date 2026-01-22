import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data");

// GET /api/tracks/:trackSlug/exercises
export const getCategories = (req, res) => {
  const { trackSlug } = req.params;
  const categories = [];

  if (fs.existsSync(path.join(DATA_DIR, trackSlug, "exercises", "concept"))) {
    categories.push("concept");
  }
  if (fs.existsSync(path.join(DATA_DIR, trackSlug, "exercises", "practice"))) {
    categories.push("practice");
  }

  res.json({ track: trackSlug, categories });
};

// GET /api/tracks/:trackSlug/exercises/:category
export const getExerciseSlugs = (req, res) => {
  const { trackSlug, category } = req.params;
  const exercisesDir = path.join(DATA_DIR, trackSlug, "exercises", category);

  if (!fs.existsSync(exercisesDir)) {
    return res.status(404).json({ error: "Category not found" });
  }

  const exercises = fs
    .readdirSync(exercisesDir)
    .filter((dir) => fs.statSync(path.join(exercisesDir, dir)).isDirectory());

  res.json({ track: trackSlug, category, exercises });
};

// GET /api/tracks/:trackSlug/exercises/:category/:exerciseSlug
export const getExerciseDetail = (req, res) => {
  const { trackSlug, category, exerciseSlug } = req.params;
  const exerciseDir = path.join(
    DATA_DIR,
    trackSlug,
    "exercises",
    category,
    exerciseSlug
  );

  if (!fs.existsSync(exerciseDir)) {
    return res.status(404).json({ error: "Exercise not found" });
  }

  // Read docs
  const docsDir = path.join(exerciseDir, ".docs");
  const docs = {};

  ["introduction.md", "instructions.md", "hints.md"].forEach((file) => {
    const filePath = path.join(docsDir, file);
    if (fs.existsSync(filePath)) {
      docs[file.replace(".md", "")] = fs.readFileSync(filePath, "utf8");
    }
  });

  // Read meta config
  const metaConfigPath = path.join(exerciseDir, ".meta", "config.json");
  let metaConfig = {};
  if (fs.existsSync(metaConfigPath)) {
    metaConfig = JSON.parse(fs.readFileSync(metaConfigPath, "utf8"));
  }

  // Read starter code (solution files)
  const starterCode = {};
  const solutionFiles = metaConfig.files?.solution || [];
  solutionFiles.forEach((pattern) => {
    const fileName = pattern
      .replace("%{snake_slug}", exerciseSlug.replace(/-/g, "_"))
      .replace("%{kebab_slug}", exerciseSlug)
      .replace(
        "%{pascal_slug}",
        exerciseSlug
          .split("-")
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join("")
      );

    const filePath = path.join(exerciseDir, fileName);
    if (fs.existsSync(filePath)) {
      starterCode[fileName] = fs.readFileSync(filePath, "utf8");
    }
  });

  // Read test files
  const testFiles = metaConfig.files?.test || [];
  let tests = "";
  testFiles.forEach((pattern) => {
    const fileName = pattern
      .replace("%{snake_slug}", exerciseSlug.replace(/-/g, "_"))
      .replace("%{kebab_slug}", exerciseSlug)
      .replace(
        "%{pascal_slug}",
        exerciseSlug
          .split("-")
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join("")
      );

    const filePath = path.join(exerciseDir, fileName);
    if (fs.existsSync(filePath)) {
      tests = fs.readFileSync(filePath, "utf8");
    }
  });

  res.json({
    track: trackSlug,
    category,
    exercise: {
      slug: exerciseSlug,
      title: metaConfig.title || exerciseSlug,
      blurb: metaConfig.blurb,
      docs,
      starter_code: starterCode,
      tests,
      source: metaConfig.source,
      source_url: metaConfig.source_url,
    },
  });
};
