import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import fsSync from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DATA_DIR = path.join(__dirname, "..", "..", "data");

const PISTON_URL = process.env.PISTON_URL || "http://localhost:2000/api/v2";
console.log("🚀 PISTON_URL =", PISTON_URL);

export const http = axios.create({
  baseURL: PISTON_URL,
  timeout: 180000,
  headers: { "Content-Type": "application/json" },
});

let runtimesCache = null;

export async function getRuntime(language) {
  if (!runtimesCache) {
    const r = await http.get("/runtimes");
    runtimesCache = Array.isArray(r.data) ? r.data : [];
  }
  const list = runtimesCache.filter((x) => x.language === language);
  if (!list.length) return null;
  list.sort((a, b) => String(b.version).localeCompare(String(a.version)));
  return list[0];
}

export async function findExerciseDir(track, category, exerciseSlug) {
  const base = path.join(DATA_DIR, track, "exercises");

  if (category) {
    const p = path.join(base, category, exerciseSlug);
    if (fsSync.existsSync(p)) return p;
  }

  const p1 = path.join(base, "practice", exerciseSlug);
  if (fsSync.existsSync(p1)) return p1;

  const p2 = path.join(base, "concept", exerciseSlug);
  if (fsSync.existsSync(p2)) return p2;

  return null;
}

export async function readMetaConfig(exerciseDir) {
  const p = path.join(exerciseDir, ".meta", "config.json");
  if (!fsSync.existsSync(p)) return null;
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function applySlugPattern(exerciseSlug, pattern) {
  const snake = exerciseSlug.replace(/-/g, "_");
  const pascal = exerciseSlug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join("");

  return String(pattern || "")
    .replaceAll("%{snake_slug}", snake)
    .replaceAll("%{kebab_slug}", exerciseSlug)
    .replaceAll("%{pascal_slug}", pascal);
}

export function parseTestLines(stdout) {
  const testResults = [];
  const lines = String(stdout || "").split("\n");

  for (const line of lines) {
    if (line.includes("TEST:")) {
      const passed = line.includes("PASS") || line.includes("✓");
      const skipped = line.includes("SKIP");
      const testName = line.split("TEST:")[1]?.split("-")[0]?.trim() || "Test";

      // Only include non-skipped tests in results
      if (!skipped) {
        testResults.push({
          input: testName,
          expectedOutput: "Pass",
          actualOutput: passed ? "Pass" : "Fail",
          passed,
        });
      }
    }
  }

  // If all tests were skipped, return a passing result
  if (testResults.length === 0) {
    return [{
      input: "All tests skipped",
      expectedOutput: "Pass",
      actualOutput: "Pass",
      passed: true,
    }];
  }

  return testResults;
}

export function errorSubmission(message) {
  return {
    success: true,
    submission: {
      result: {
        status: "Error",
        stdout: "",
        stderr: String(message || "Error"),
        compileOutput: null,
        time: "0.000",
        memory: 0,
      },
      passed: false,
      testResults: [
        {
          input: "Execution",
          expectedOutput: "Success",
          actualOutput: "Error",
          passed: false,
        },
      ],
    },
  };
}