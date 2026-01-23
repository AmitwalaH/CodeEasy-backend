import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");

export const getConceptDetail = (req, res) => {
  const { trackSlug, conceptSlug } = req.params;
  const conceptDir = path.join(DATA_DIR, trackSlug, "concepts", conceptSlug);

  if (!fs.existsSync(conceptDir)) {
    return res.status(404).json({ error: "Concept not found" });
  }

  let about = "";
  let introduction = "";
  let links = [];
  let config = {};

  const aboutPath = path.join(conceptDir, "about.md");
  const introPath = path.join(conceptDir, "introduction.md");
  const linksPath = path.join(conceptDir, "links.json");
  const configPath = path.join(conceptDir, ".meta", "config.json");

  if (fs.existsSync(aboutPath)) {
    about = fs.readFileSync(aboutPath, "utf8");
  }
  if (fs.existsSync(introPath)) {
    introduction = fs.readFileSync(introPath, "utf8");
  }
  if (fs.existsSync(linksPath)) {
    links = JSON.parse(fs.readFileSync(linksPath, "utf8"));
  }
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  }

  res.json({
    success: true,
    concept: {
      slug: conceptSlug,
      title: config.title || conceptSlug,
      blurb: config.blurb || "",
      authors: config.authors || [],
      about,
      introduction,
      links,
    },
  });
};
