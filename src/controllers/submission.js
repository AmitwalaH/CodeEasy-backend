import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Judge0 API URL
const JUDGE0_URL = process.env.JUDGE0_URL || "https://judge0-ce.p.rapidapi.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY;

// Language IDs for Judge0
const LANGUAGE_IDS = {
  c: 50,
  cpp: 54,
  javascript: 63,
  python: 71,
  java: 62,
  ruby: 72,
  typescript: 74,
  go: 60,
  rust: 73,
};

// Get file extension for track
const getExtension = (track) => {
  const extensions = {
    c: "c",
    cpp: "cpp",
    javascript: "js",
    python: "py",
    java: "java",
    ruby: "rb",
    typescript: "ts",
    go: "go",
    rust: "rs",
  };
  return extensions[track] || "txt";
};

// Helper to read test file
const getTestFile = (track, category, exerciseSlug, dataPath) => {
  const exercisePath = path.join(
    dataPath,
    track,
    "exercises",
    category,
    exerciseSlug
  );

  const testPatterns = [
    `${exerciseSlug.replace(/-/g, "_")}_test.${getExtension(track)}`,
    `test_${exerciseSlug.replace(/-/g, "_")}.${getExtension(track)}`,
    `${exerciseSlug}.spec.js`,
    `${exerciseSlug}.test.js`,
    `test_${exerciseSlug}.py`,
    `${exerciseSlug}_test.rb`,
  ];

  for (const pattern of testPatterns) {
    const testPath = path.join(exercisePath, pattern);
    if (fs.existsSync(testPath)) {
      return fs.readFileSync(testPath, "utf8");
    }
  }

  const metaTestPath = path.join(exercisePath, ".meta", "tests.toml");
  if (fs.existsSync(metaTestPath)) {
    return fs.readFileSync(metaTestPath, "utf8");
  }

  return null;
};

// Helper to get header file (C/C++)
const getHeaderFile = (track, category, exerciseSlug, dataPath) => {
  if (track !== "c" && track !== "cpp") return null;

  const exercisePath = path.join(
    dataPath,
    track,
    "exercises",
    category,
    exerciseSlug
  );

  const headerPath = path.join(
    exercisePath,
    `${exerciseSlug.replace(/-/g, "_")}.h`
  );

  return fs.existsSync(headerPath) ? fs.readFileSync(headerPath, "utf8") : null;
};

// Parse test cases
const parseTestCases = (testContent) => {
  if (!testContent) {
    return [
      {
        input: "",
        expectedOutput: "Test file not found",
        description: "No tests",
      },
    ];
  }

  return [
    {
      description: "Run tests",
      input: "submission",
      expectedOutput: "All tests pass",
    },
  ];
};

// Build full source code
const buildSourceCode = (userCode, testContent, headerContent, track) => {
  if (track === "c" || track === "cpp") {
    return `
${headerContent || ""}
${userCode}
${testContent || ""}
`;
  }

  return `${userCode}\n\n${testContent || ""}`;
};

// Submit to Judge0
const submitToJudge0 = async (sourceCode, languageId) => {
  const headers = { "Content-Type": "application/json" };

  if (JUDGE0_API_KEY) {
    headers["X-RapidAPI-Key"] = JUDGE0_API_KEY;
    headers["X-RapidAPI-Host"] = "judge0-ce.p.rapidapi.com";
  }

  const response = await axios.post(
    `${JUDGE0_URL}/submissions?wait=true`,
    {
      source_code: sourceCode,
      language_id: languageId,
    },
    { headers }
  );

  return response.data;
};

// ✅ MAIN HANDLER
export const submitCode = async (req, res) => {
  try {
    const { track, category, exerciseSlug, sourceCode, languageId } = req.body;
    const dataPath = path.join(__dirname, "..", "data");

    if (!track || !category || !exerciseSlug || !sourceCode) {
      return res.status(400).json({
        error:
          "Missing required fields: track, category, exerciseSlug, sourceCode",
      });
    }

    const testContent = getTestFile(track, category, exerciseSlug, dataPath);
    const headerContent = getHeaderFile(
      track,
      category,
      exerciseSlug,
      dataPath
    );

    const testCases = parseTestCases(testContent);

    const fullCode = buildSourceCode(
      sourceCode,
      testContent,
      headerContent,
      track
    );

    const langId = languageId || LANGUAGE_IDS[track] || 63;
    const result = await submitToJudge0(fullCode, langId);

    const passed = result.status?.id === 3;

    res.json({
      message: passed ? "All tests passed!" : "Some tests failed",
      passed,
      testResults: testCases.map(() => ({
        passed,
        actualOutput: passed ? "Pass" : result.stderr || result.compile_output,
      })),
      result,
    });
  } catch (error) {
    console.error("Submission error:", error);
    res.status(500).json({ error: "Submission failed" });
  }
};
