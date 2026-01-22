import fs from "fs";
import path from "path";
import axios from "axios";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data");
const JUDGE0_URL =
  process.env.JUDGE0_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;

// Judge0 Language IDs
const LANGUAGE_IDS = {
  python: 71,
  javascript: 63,
  typescript: 74,
  java: 62,
  c: 50,
  cpp: 54,
  ruby: 72,
  go: 60,
  rust: 73,
  csharp: 51,
  php: 68,
  swift: 83,
  kotlin: 78,
  scala: 81,
  elixir: 57,
  haskell: 61,
  lua: 64,
  r: 80,
  perl: 85,
};

export const submitCode = async (req, res) => {
  const { track, category, exerciseSlug, sourceCode, languageId } = req.body;

  try {
    const exerciseDir = path.join(
      DATA_DIR,
      track,
      "exercises",
      category,
      exerciseSlug
    );

    const response = await axios.post(
      `${JUDGE0_URL}/submissions?base64_encoded=false&wait=true`,
      {
        source_code: sourceCode,
        language_id: languageId,
      },
      {
        headers: {
          "X-RapidAPI-Key": JUDGE0_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    res.json({
      success: true,
      submission: {
        result: response.data,
        passed: response.data.status?.id === 3,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
