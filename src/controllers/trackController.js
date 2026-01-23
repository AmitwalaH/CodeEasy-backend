import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data");

// GET /api/tracks - List all available tracks
export const getAllTracks = (req, res) => {
  try {
    const tracks = fs
      .readdirSync(DATA_DIR)
      .filter((dir) => {
        const configPath = path.join(DATA_DIR, dir, "config.json");
        return fs.existsSync(configPath);
      })
      .map((slug) => {
        const config = JSON.parse(
          fs.readFileSync(path.join(DATA_DIR, slug, "config.json"), "utf8"),
        );
        return {
          slug,
          name: config.language,
          blurb: config.blurb,
          active: config.active,
          conceptCount: config.concepts?.length || 0,
          exerciseCount:
            (config.exercises?.concept?.length || 0) +
            (config.exercises?.practice?.length || 0),
        };
      });

    res.json({ success: true, tracks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// GET /api/tracks/:trackSlug/config
export const getTrackConfig = (req, res) => {
  const { trackSlug } = req.params;
  const configPath = path.join(DATA_DIR, trackSlug, "config.json");

  if (!fs.existsSync(configPath)) {
    return res.status(404).json({ error: "Track not found" });
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  res.json({ config });
};

// GET /api/tracks/:trackSlug/about - Get track about.md
export const getTrackAbout = (req, res) => {
  const { trackSlug } = req.params;
  const aboutPath = path.join(DATA_DIR, trackSlug, "docs", "ABOUT.md");

  if (!fs.existsSync(aboutPath)) {
    return res.status(404).json({ error: "About not found" });
  }

  const about = fs.readFileSync(aboutPath, "utf8");
  res.json({ success: true, about });
};

// GET /api/tracks/:trackSlug/concepts - List all concepts
export const getAllConcepts = (req, res) => {
  const { trackSlug } = req.params;
  const configPath = path.join(DATA_DIR, trackSlug, "config.json");

  if (!fs.existsSync(configPath)) {
    return res.status(404).json({ error: "Track not found" });
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const concepts = config.concepts || [];

  res.json({
    success: true,
    track: trackSlug,
    concepts: concepts.map((c) => ({
      slug: c.slug,
      name: c.name,
      uuid: c.uuid,
    })),
  });
};
