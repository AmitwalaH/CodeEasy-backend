import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Recreate __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get concept detail (from JSON files)
export const getConceptDetail = async (req, res) => {
  try {
    const { trackSlug, conceptSlug } = req.params;
    const dataPath = path.join(__dirname, "..", "..", "data");

    // Path to concept JSON file
    const conceptJsonPath = path.join(
      dataPath,
      trackSlug,
      "concepts",
      `${conceptSlug}.json`
    );

    // Check if JSON file exists
    if (!fs.existsSync(conceptJsonPath)) {
      return res.status(404).json({
        error: `Concept not found: ${trackSlug}/${conceptSlug}`,
        about: "",
        links: [],
      });
    }

    // Read JSON content
    const conceptData = JSON.parse(fs.readFileSync(conceptJsonPath, "utf8"));

    // Extract about - check both 'about' and 'introduction' fields
    let about = "";

    // Check if docs object exists
    if (conceptData.docs) {
      // Use 'about' if exists, otherwise use 'introduction'
      about = conceptData.docs.about || conceptData.docs.introduction || "";
    } else {
      // If no docs object, check for direct properties
      about = conceptData.about || conceptData.introduction || "";
    }

    const links = conceptData.links || [];

    res.json({
      track: trackSlug,
      concept: conceptSlug,
      about,
      links,
    });
  } catch (error) {
    console.error("Concept detail error:", error);
    res.status(500).json({
      error: "Failed to load concept",
      about: "",
      links: [],
    });
  }
};