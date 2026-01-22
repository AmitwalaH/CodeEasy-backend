import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data");

// GET /api/tracks/:trackSlug/concepts/:conceptSlug
export const getConceptDetail = (req, res) => {
  const { trackSlug, conceptSlug } = req.params;
  const conceptDir = path.join(DATA_DIR, trackSlug, "concepts", conceptSlug);

  if (!fs.existsSync(conceptDir)) {
    return res.status(404).json({ error: "Concept not found" });
  }

  let about = "";
  let introduction = "";
  let links = [];

  const aboutPath = path.join(conceptDir, "about.md");
  const introPath = path.join(conceptDir, "introduction.md");
  const linksPath = path.join(conceptDir, "links.json");

  if (fs.existsSync(aboutPath)) {
    about = fs.readFileSync(aboutPath, "utf8");
  }
  if (fs.existsSync(introPath)) {
    introduction = fs.readFileSync(introPath, "utf8");
  }
  if (fs.existsSync(linksPath)) {
    links = JSON.parse(fs.readFileSync(linksPath, "utf8"));
  }

  res.json({ about, introduction, links });
};
