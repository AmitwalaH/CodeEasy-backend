import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import fsSync from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DATA_DIR = path.join(__dirname, "..", "data");

// Piston URL
export const PISTON_URL =
  process.env.PISTON_URL || "https://emkc.org/api/v2/piston";

// Axios client
export const http = axios.create({
  baseURL: PISTON_URL,
  timeout: 180000,
  headers: { "Content-Type": "application/json" },
});

let cachedRuntimes = null;

export async function getRuntime(language) {
  if (!cachedRuntimes) {
    const r = await http.get("/runtimes");
    cachedRuntimes = Array.isArray(r.data) ? r.data : [];
  }

  const list = cachedRuntimes.filter((x) => x.language === language);
  if (!list.length) return null;

  // picking latest version
  list.sort((a, b) => String(b.version).localeCompare(String(a.version)));
  return list[0];
}

export async function findExerciseDir(track, category, exerciseSlug) {
  const base = path.join(DATA_DIR, track, "exercises");

  // if category exists (practice/concept)
  if (category) {
    const p = path.join(base, category, exerciseSlug);
    if (fsSync.existsSync(p)) return p;
  }

  // fallback common
  const p1 = path.join(base, "practice", exerciseSlug);
  if (fsSync.existsSync(p1)) return p1;

  const p2 = path.join(base, "concept", exerciseSlug);
  if (fsSync.existsSync(p2)) return p2;

  return null;
}

export async function readMetaConfig(exerciseDir) {
  const filePath = path.join(exerciseDir, ".meta", "config.json");
  if (!fsSync.existsSync(filePath)) return null;

  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Replace %{snake_slug} etc
export function applySlugPattern(exerciseSlug, pattern) {
  const snake = exerciseSlug.replace(/-/g, "_");
  const pascal = exerciseSlug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join("");

  return pattern
    .replaceAll("%{snake_slug}", snake)
    .replaceAll("%{kebab_slug}", exerciseSlug)
    .replaceAll("%{pascal_slug}", pascal);
}

// =======================
// Parse "TEST: xxx - PASS ✓" like JS
// =======================
export function parseTestLines(stdout) {
  const out = [];
  const lines = String(stdout || "").split("\n");

  for (const line of lines) {
    if (!line.includes("TEST:")) continue;

    const passed = line.includes("PASS") || line.includes("✓");
    const name = line.split("TEST:")[1]?.split("-")[0]?.trim() || "Test";

    out.push({
      input: name,
      expectedOutput: "Pass",
      actualOutput: passed ? "Pass" : "Fail",
      passed,
    });
  }

  return out;
}
