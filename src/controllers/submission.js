// src/controllers/submissionController.js
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs/promises";
import fsSync from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, "..", "data");
const PISTON_URL = process.env.PISTON_URL || "https://emkc.org/api/v2/piston";

const http = axios.create({
  baseURL: PISTON_URL,
  timeout: 30000,
  headers: { "Content-Type": "application/json" },
});

// Judge0 ID -> Piston language
const languageMap = {
  50: { language: "c", version: "10.2.0", extension: ".c" },
  54: { language: "cpp", version: "10.2.0", extension: ".cpp" },
  63: { language: "javascript", version: "18.15.0", extension: ".js" },
  71: { language: "python", version: "3.10.0", extension: ".py" },
  62: { language: "java", version: "15.0.2", extension: ".java" },
  72: { language: "ruby", version: "3.0.1", extension: ".rb" },
  74: { language: "typescript", version: "5.0.3", extension: ".ts" },
  60: { language: "go", version: "1.16.2", extension: ".go" },
  73: { language: "rust", version: "1.68.2", extension: ".rs" },
  51: { language: "csharp", version: "6.12.0", extension: ".cs" },
  68: { language: "php", version: "8.2.3", extension: ".php" },
  83: { language: "swift", version: "5.3.3", extension: ".swift" },
  78: { language: "kotlin", version: "1.8.20", extension: ".kt" },
  81: { language: "scala", version: "3.2.2", extension: ".scala" },
  57: { language: "elixir", version: "1.11.3", extension: ".ex" },
  61: { language: "haskell", version: "9.0.1", extension: ".hs" },
  64: { language: "lua", version: "5.4.4", extension: ".lua" },
  80: { language: "rscript", version: "4.1.1", extension: ".r" },
  85: { language: "perl", version: "5.36.0", extension: ".pl" },
  46: { language: "bash", version: "5.2.0", extension: ".sh" },
  90: { language: "dart", version: "2.19.6", extension: ".dart" },
};

export const submitCode = async (req, res) => {
  try {
    const body = req.body || {};
    const {
      track,
      category,
      exerciseSlug,
      sourceCode,
      source_code,
      languageId,
      language_id,
      stdin,
    } = body;

    const finalSource = String(sourceCode ?? source_code ?? "").trim();
    const finalLang = Number(languageId ?? language_id ?? 63);

    console.log("=== PISTON SUBMISSION ===");
    console.log("Track:", track);
    console.log("Category:", category);
    console.log("Exercise:", exerciseSlug);
    console.log("Language ID:", finalLang);
    console.log("Source length:", finalSource.length);

    if (!finalSource) {
      return res
        .status(400)
        .json({ success: false, error: "Source code is missing or empty" });
    }

    const langConfig = languageMap[finalLang];
    if (!langConfig) {
      return res.status(400).json({
        success: false,
        error: `Language ID ${finalLang} not supported. Supported IDs: ${Object.keys(
          languageMap
        ).join(", ")}`,
      });
    }

    console.log("Language:", langConfig.language);

    if (langConfig.language === "javascript") {
      const result = await handleJavaScript(
        track,
        category,
        exerciseSlug,
        finalSource,
        stdin
      );
      return res.json(result);
    }

    if (langConfig.language === "c") {
      const result = await handleC(
        track,
        category,
        exerciseSlug,
        finalSource,
        stdin
      );
      return res.json(result);
    }

    return res.status(400).json({
      success: false,
      error: `Language ${langConfig.language} not yet implemented. Only JavaScript and C are supported today.`,
    });
  } catch (error) {
    console.error("=== PISTON ERROR ===");
    console.error("Error:", error.message);
    console.error("Response:", error.response?.data);

    return res.status(500).json({
      success: false,
      error: error.response?.data?.message || error.message,
    });
  }
};

// =======================
// Helpers: resolve exercise dir + test file
// =======================
async function resolveExerciseDir(track, category, exerciseSlug) {
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

function replaceSlugPatterns(exerciseSlug, pattern) {
  return pattern
    .replaceAll("%{snake_slug}", exerciseSlug.replace(/-/g, "_"))
    .replaceAll("%{kebab_slug}", exerciseSlug)
    .replaceAll(
      "%{pascal_slug}",
      exerciseSlug
        .split("-")
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join("")
    );
}

async function findJsTestFile(exerciseDir, exerciseSlug) {
  // Best: use .meta/config.json files.test
  const metaConfigPath = path.join(exerciseDir, ".meta", "config.json");
  if (fsSync.existsSync(metaConfigPath)) {
    try {
      const meta = JSON.parse(await fs.readFile(metaConfigPath, "utf8"));
      const testFiles = meta?.files?.test || [];
      for (const pat of testFiles) {
        const fileName = replaceSlugPatterns(exerciseSlug, pat);
        const p = path.join(exerciseDir, fileName);
        if (fsSync.existsSync(p)) return p;
      }
    } catch {
      // ignore
    }
  }

  // Fallback common names
  const candidates = [
    path.join(exerciseDir, `${exerciseSlug}.spec.js`),
    path.join(exerciseDir, `${exerciseSlug}.test.js`),
  ];

  for (const p of candidates) {
    if (fsSync.existsSync(p)) return p;
  }

  return null;
}

// =======================
// JAVASCRIPT (Jest -> Plain runner)
// =======================
async function handleJavaScript(track, category, exerciseSlug, userCode, stdin) {
  const exerciseDir = await resolveExerciseDir(track, category, exerciseSlug);

  if (!exerciseDir) {
    return {
      success: true,
      submission: {
        result: {
          status: "Not Found",
          stdout: "",
          stderr: `Exercise not found: ${track}/${category}/${exerciseSlug}`,
          compileOutput: null,
          time: "0.000",
          memory: 0,
        },
        passed: false,
        testResults: [
          {
            input: "Exercise lookup",
            expectedOutput: "Found",
            actualOutput: "Not Found",
            passed: false,
          },
        ],
      },
    };
  }

  // 1) Load raw test file
  let rawTest = "";
  const testFilePath = await findJsTestFile(exerciseDir, exerciseSlug);
  if (testFilePath) {
    try {
      rawTest = await fs.readFile(testFilePath, "utf-8");
    } catch {
      rawTest = "";
    }
  }

  // 2) Convert to plain JS runner
  let testCode = "";
  if (rawTest) {
    testCode = convertJestToPlainJS(rawTest);
    console.log("✓ Jest test file converted");
    console.log(
      "✓ Test file:",
      testFilePath ? path.basename(testFilePath) : "(unknown)"
    );
  } else {
    console.log("ℹ No test file found");
    testCode = makeNoTestsRunner();
  }

  // 3) Clean user code (so it can live in same file)
  const userCodeCleaned = cleanUserJS(userCode);

  // 4) Combine
  const combinedCode = `${userCodeCleaned}\n\n${testCode}`;

  // 5) Send to Piston
  const payload = {
    language: "javascript",
    version: "18.15.0",
    files: [{ name: "main.js", content: combinedCode }],
    stdin: stdin || "",
  };

  console.log("Sending JavaScript to Piston...");
  const result = await http.post("/execute", payload);
  const output = result.data;

  console.log("JavaScript execution complete");
  console.log("STDOUT:\n", output.run?.stdout || "");
  console.log("STDERR:\n", output.run?.stderr || "");
  console.log("Exit code:", output.run?.code);

  const testResults = parseJavaScriptTestOutput(output);
  const allPassed = testResults.every((t) => t.passed);

  return {
    success: true,
    submission: {
      result: {
        status: allPassed ? "Accepted" : "Wrong Answer",
        stdout: output.run?.stdout || "",
        stderr: output.run?.stderr || "",
        compileOutput: null,
        time: ((output.run?.time || 0) / 1000).toFixed(3),
        memory: output.run?.memory || 0,
      },
      passed: allPassed,
      testResults,
    },
  };
}

function cleanUserJS(userCode) {
  let code = String(userCode ?? "");

  // Remove ESM exports so functions/classes become normal declarations in same file.
  code = code
    .replace(/^\s*export\s+default\s+/gm, "")
    .replace(/^\s*export\s+\{[^}]+\}\s*;?\s*$/gm, "")
    .replace(/^\s*export\s+/gm, "");

  // Remove ESM imports (if user pasted them)
  code = code.replace(/^\s*import\s+.*?;?\s*$/gm, "");

  return code.trim();
}

function makeNoTestsRunner() {
  return `
(function () {
  console.log("No tests available");
  process.exit(0);
})();
`.trim();
}

// =======================
// Jest -> Plain JS converter (FIXED for multiline imports)
// =======================
function convertJestToPlainJS(jestCode) {
  let code = String(jestCode);

  // ✅ REMOVE ALL IMPORTS (single-line + multiline)
  code = code.replace(/^\s*import\s+[\s\S]*?;\s*$/gm, "");

  // remove xit/xtest blocks entirely (skip)
  code = code.replace(
    /(?:xtest|xit)\s*\(\s*['"`][\s\S]*?['"`]\s*,\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\)\s*;?/g,
    ""
  );

  // describe -> runner start (first describe becomes suite wrapper)
  code = code.replace(
    /describe\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\(\)\s*=>\s*\{/,
    (_m, suite) => `
function __runTests__() {
  let passedCount = 0;
  let failedCount = 0;
  console.log("Running tests...");
  console.log("Suite: ${escapeForTemplate(String(suite))}\\n");
`
  );

  // test/it blocks
  code = code.replace(
    /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*\)\s*;?/g,
    (_m, testName, body) => {
      const expects = extractExpects(String(body));

      // if no expects, best-effort execute body
      if (expects.length === 0) {
        return `
  try {
${indentBlock(String(body).trim(), 4)}
    console.log("TEST: ${escapeForTemplate(String(testName))} - PASS ✓");
    passedCount++;
  } catch (error) {
    console.log("TEST: ${escapeForTemplate(String(testName))} - FAIL ✗");
    console.log("  Error:", error?.message || String(error));
    failedCount++;
  }
`;
      }

      const checks = expects
        .map((ex, i) => {
          if (ex.matcher === "toThrow") {
            return `
    // Expect ${i + 1}: toThrow
    {
      let __threw__ = false;
      try { (${ex.actual}); } catch { __threw__ = true; }
      if (!__threw__) throw new Error("Expected function to throw");
    }
`;
          }

          return `
    // Expect ${i + 1}: ${ex.matcher}
    {
      const __actual__ = (${ex.actual});
      const __expected__ = (${ex.expected});
      if (JSON.stringify(__actual__) !== JSON.stringify(__expected__)) {
        throw new Error("Expected " + JSON.stringify(__expected__) + " but got " + JSON.stringify(__actual__));
      }
    }
`;
        })
        .join("");

      return `
  try {
${checks}
    console.log("TEST: ${escapeForTemplate(String(testName))} - PASS ✓");
    passedCount++;
  } catch (error) {
    console.log("TEST: ${escapeForTemplate(String(testName))} - FAIL ✗");
    console.log("  Error:", error?.message || String(error));
    failedCount++;
  }
`;
    }
  );

  // remove leftover describe closures lines "});"
  code = code.replace(/^\s*\}\);\s*$/gm, "");
  code = code.replace(/^\s*describe\s*\(.*$/gm, "");

  if (!code.includes("function __runTests__()")) {
    return `
(function () {
  console.log("No runnable tests found in spec.");
  process.exit(0);
})();
`.trim();
  }

  // footer
  code += `
  console.log("\\n" + "=".repeat(40));
  console.log("Results:", passedCount, "passed,", failedCount, "failed");
  console.log("=".repeat(40));
  if (failedCount > 0) process.exit(1);
}

__runTests__();
`;

  return code.trim();
}

function extractExpects(body) {
  const out = [];

  // expect(A).toBe(B) / toEqual / toStrictEqual
  const re1 =
    /expect\s*\(\s*([\s\S]*?)\s*\)\s*\.\s*(toBe|toEqual|toStrictEqual)\s*\(\s*([\s\S]*?)\s*\)\s*;?/g;
  let m;
  while ((m = re1.exec(body)) !== null) {
    out.push({
      actual: m[1].trim(),
      matcher: m[2].trim(),
      expected: m[3].trim(),
    });
  }

  // expect(() => fn()).toThrow()
  const re2 =
    /expect\s*\(\s*\(\s*\)\s*=>\s*([\s\S]*?)\s*\)\s*\.\s*toThrow\s*\(\s*\)\s*;?/g;
  while ((m = re2.exec(body)) !== null) {
    out.push({ actual: m[1].trim(), matcher: "toThrow", expected: null });
  }

  return out;
}

function indentBlock(text, spaces) {
  const pad = " ".repeat(spaces);
  return text
    .split("\n")
    .map((l) => (l.trim() ? pad + l : l))
    .join("\n");
}

function escapeForTemplate(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

function parseJavaScriptTestOutput(output) {
  const testResults = [];
  const stdout = output.run?.stdout || "";
  const exitCode = output.run?.code ?? 0;

  const lines = stdout.split("\n");
  for (const line of lines) {
    if (line.includes("TEST:")) {
      const passed = line.includes("PASS") || line.includes("✓");
      const testName =
        line.split("TEST:")[1]?.split("-")[0]?.trim() || "Test";
      testResults.push({
        input: testName,
        expectedOutput: "Pass",
        actualOutput: passed ? "Pass" : "Fail",
        passed,
      });
    }
  }

  if (testResults.length === 0) {
    testResults.push({
      input: "Execution",
      expectedOutput: "Success",
      actualOutput: exitCode === 0 ? "Success" : "Error",
      passed: exitCode === 0,
    });
  }

  return testResults;
}

// =======================
// C (Unity)
// =======================
async function handleC(track, category, exerciseSlug, userCode, stdin) {
  const exerciseDir = path.join(
    DATA_DIR,
    track,
    "exercises",
    category,
    exerciseSlug
  );

  const headerFile = exerciseSlug.replace(/-/g, "_") + ".h";
  const headerPath = path.join(exerciseDir, headerFile);
  let headerContent = "";

  try {
    headerContent = await fs.readFile(headerPath, "utf-8");
    console.log("✓ Header file loaded:", headerFile);
  } catch {
    console.log("⚠ No header file found");
  }

  const testFile = "test_" + exerciseSlug.replace(/-/g, "_") + ".c";
  const testPath = path.join(exerciseDir, testFile);
  let testContent = "";

  try {
    testContent = await fs.readFile(testPath, "utf-8");
    console.log("✓ Test file loaded:", testFile);
  } catch {
    console.log("⚠ No test file found");
  }

  const unityPath = path.join(exerciseDir, "test-framework");
  let unityC = "";
  let unityH = "";

  try {
    unityC = await fs.readFile(path.join(unityPath, "unity.c"), "utf-8");
    unityH = await fs.readFile(path.join(unityPath, "unity.h"), "utf-8");
    console.log("✓ Unity framework loaded");
  } catch {
    console.log("⚠ Unity framework not found, using simplified version");
    unityH = getSimplifiedUnityHeader();
    unityC = getSimplifiedUnityImplementation();
  }

  const files = [
    { name: "unity.h", content: unityH },
    { name: "unity.c", content: unityC },
    { name: headerFile, content: headerContent },
    { name: exerciseSlug.replace(/-/g, "_") + ".c", content: userCode },
    { name: testFile, content: testContent },
  ];

  const payload = {
    language: "c",
    version: "10.2.0",
    files,
    stdin: stdin || "",
    compile_timeout: 10000,
    run_timeout: 3000,
    args: [],
  };

  console.log("Compiling and running C code...");
  const result = await http.post("/execute", payload);
  const output = result.data;

  console.log("C execution complete");
  console.log("Exit code:", output.run?.code);
  console.log("Compile code:", output.compile?.code);

  if (output.compile && output.compile.code !== 0) {
    return {
      success: true,
      submission: {
        result: {
          status: "Compilation Error",
          stdout: output.compile.stdout || "",
          stderr: output.compile.stderr || "",
          compileOutput: output.compile.stderr || "",
          time: "0",
          memory: 0,
        },
        passed: false,
        testResults: [
          {
            input: "Compilation",
            expectedOutput: "Success",
            actualOutput: "Failed",
            passed: false,
          },
        ],
      },
    };
  }

  const testResults = parseCTestOutput(output);
  const allPassed = testResults.every((t) => t.passed);

  return {
    success: true,
    submission: {
      result: {
        status: allPassed ? "Accepted" : "Wrong Answer",
        stdout: output.run?.stdout || "",
        stderr: output.run?.stderr || "",
        compileOutput: output.compile?.stderr || null,
        time: ((output.run?.time || 0) / 1000).toFixed(3),
        memory: output.run?.memory || 0,
      },
      passed: allPassed,
      testResults,
    },
  };
}

function parseCTestOutput(output) {
  const testResults = [];
  const stdout = output.run?.stdout || "";
  const stderr = output.run?.stderr || "";
  const exitCode = output.run?.code ?? 0;

  const lines = (stdout + "\n" + stderr).split("\n");
  for (const line of lines) {
    const match = line.match(
      /test_\w+\.c:\d+:(\w+):(PASS|FAIL)(?::\s*(.+))?/
    );
    if (match) {
      const testName = match[1];
      const status = match[2];
      const message = match[3] || "";
      testResults.push({
        input: testName.replace(/_/g, " "),
        expectedOutput: "Pass",
        actualOutput: status === "PASS" ? "Pass" : message || "Fail",
        passed: status === "PASS",
      });
    }
  }

  const summaryMatch = (stdout + stderr).match(
    /(\d+)\s+Tests?\s+(\d+)\s+Failures?/i
  );
  if (summaryMatch && testResults.length === 0) {
    const totalTests = parseInt(summaryMatch[1], 10);
    const failures = parseInt(summaryMatch[2], 10);
    testResults.push({
      input: `${totalTests} test(s)`,
      expectedOutput: "All Pass",
      actualOutput: failures === 0 ? "All Pass" : `${failures} failed`,
      passed: failures === 0,
    });
  }

  if (testResults.length === 0) {
    testResults.push({
      input: "Test Execution",
      expectedOutput: "Success",
      actualOutput: exitCode === 0 ? "Success" : "Failed",
      passed: exitCode === 0,
    });
  }

  return testResults;
}

// Simplified Unity header
function getSimplifiedUnityHeader() {
  return `#ifndef UNITY_H
#define UNITY_H

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

void UnityBegin(const char* filename);
int UnityEnd(void);
void UnityAssertEqualString(const char* expected, const char* actual, int line, const char* msg);

#define UNITY_BEGIN() UnityBegin(__FILE__)
#define UNITY_END() UnityEnd()
#define RUN_TEST(func) { setUp(); func(); tearDown(); }
#define TEST_ASSERT_EQUAL_STRING(expected, actual) UnityAssertEqualString(expected, actual, __LINE__, #actual)

void setUp(void);
void tearDown(void);

#endif
`;
}

function getSimplifiedUnityImplementation() {
  return `#include "unity.h"

static int tests_run = 0;
static int tests_failed = 0;
static const char* current_file = "";

void UnityBegin(const char* filename) {
    current_file = filename;
    tests_run = 0;
    tests_failed = 0;
}

int UnityEnd(void) {
    printf("\\n%d Tests %d Failures 0 Ignored\\n", tests_run, tests_failed);
    return tests_failed == 0 ? 0 : 1;
}

void UnityAssertEqualString(const char* expected, const char* actual, int line, const char* msg) {
    tests_run++;
    if (strcmp(expected, actual) == 0) {
        printf("%s:%d:test:PASS\\n", current_file, line);
    } else {
        printf("%s:%d:test:FAIL: Expected \\"%s\\" Was \\"%s\\"\\n",
               current_file, line, expected, actual);
        tests_failed++;
    }
}

void setUp(void) {}
void tearDown(void) {}
`;
}
