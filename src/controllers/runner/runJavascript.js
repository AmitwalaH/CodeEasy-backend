import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import {
  http,
  findExerciseDir,
  readMetaConfig,
  applySlugPattern,
  parseTestLines,
} from "./common.js";

function cleanUserCode(code) {
  let out = String(code || "");

  // remove exports
  out = out
    .replace(/^\s*export\s+default\s+/gm, "")
    .replace(/^\s*export\s+\{[^}]+\}\s*;?\s*$/gm, "")
    .replace(/^\s*export\s+/gm, "");

  // remove imports
  out = out.replace(/^\s*import\s+.*?;?\s*$/gm, "");

  return out.trim();
}

function noTestsRunner() {
  return `
(function () {
  console.log("No tests available");
  process.exit(0);
})();
`.trim();
}

function convertJestToSimpleRunner(jestCode) {
  let code = String(jestCode || "");

  // remove imports
  code = code.replace(/^\s*import\s+[\s\S]*?;\s*$/gm, "");

  // remove describe line
  code = code.replace(
    /describe\s*\(\s*['"`][\s\S]*?['"`]\s*,\s*\(\)\s*=>\s*\{/,
    () => `function __runTests__() {\n`,
  );

  // convert test/it blocks
  code = code.replace(
    /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*\)\s*;?/g,
    (_m, testName, body) => {
      return `
  try {
${body.trim()}
    console.log("TEST: ${testName} - PASS ✓");
  } catch (e) {
    console.log("TEST: ${testName} - FAIL ✗");
    console.log("  Error:", e?.message || String(e));
    process.exitCode = 1;
  }
`;
    },
  );

  // remove closing "});"
  code = code.replace(/^\s*\}\);\s*$/gm, "");

  code += `
}
__runTests__();
if (process.exitCode) process.exit(process.exitCode);
`;

  return code.trim();
}

async function findTestFile(exerciseDir, exerciseSlug) {
  const meta = await readMetaConfig(exerciseDir);

  const testPatterns = meta?.files?.test || [];
  for (const pat of testPatterns) {
    const name = applySlugPattern(exerciseSlug, pat);
    const p = path.join(exerciseDir, name);
    if (fsSync.existsSync(p)) return p;
  }

  const fallback = [
    path.join(exerciseDir, `${exerciseSlug}.spec.js`),
    path.join(exerciseDir, `${exerciseSlug}.test.js`),
  ];

  for (const p of fallback) {
    if (fsSync.existsSync(p)) return p;
  }

  return null;
}

export async function runJavascript({
  track,
  category,
  exerciseSlug,
  userCode,
  stdin,
}) {
  const exerciseDir = await findExerciseDir(track, category, exerciseSlug);
  if (!exerciseDir) {
    return {
      success: true,
      submission: {
        result: {
          status: "Not Found",
          stdout: "",
          stderr: `Exercise not found`,
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

  const testPath = await findTestFile(exerciseDir, exerciseSlug);
  let testContent = "";
  if (testPath) {
    try {
      testContent = await fs.readFile(testPath, "utf8");
    } catch {}
  }

  const runnerCode = testContent
    ? convertJestToSimpleRunner(testContent)
    : noTestsRunner();
  const combined = `${cleanUserCode(userCode)}\n\n${runnerCode}`;

  const payload = {
    language: "javascript",
    version: "18.15.0",
    files: [{ name: "main.js", content: combined }],
    stdin: stdin || "",
  };

  const r = await http.post("/execute", payload);
  const output = r.data;

  const stdout = output.run?.stdout || "";
  const exitCode = output.run?.code ?? 0;

  const testResults = parseTestLines(stdout);
  if (testResults.length === 0) {
    testResults.push({
      input: "Execution",
      expectedOutput: "Success",
      actualOutput: exitCode === 0 ? "Success" : "Failed",
      passed: exitCode === 0,
    });
  }

  const allPassed = testResults.every((t) => t.passed);

  return {
    success: true,
    submission: {
      result: {
        status: allPassed ? "Accepted" : "Wrong Answer",
        stdout,
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
