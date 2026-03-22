import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import {
  http,
  findExerciseDir,
  readMetaConfig,
  applySlugPattern,
  parseTestLines,
  errorSubmission,
} from "./common.js";

function cleanUserJS(userCode) {
  let code = String(userCode ?? "");
  code = code
    .replace(/^\s*export\s+default\s+/gm, "")
    .replace(/^\s*export\s+\{[^}]+\}\s*;?\s*$/gm, "")
    .replace(/^\s*export\s+/gm, "");
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

// 🔥 FINAL UNIVERSAL PARSER (supports equal + toThrow)
function convertJestToPlainJS(jestCode) {
  const code = String(jestCode);
  const tests = [];

  // ✅ toEqual / toBe
  const re1 =
    /expect\s*\(\s*([\s\S]*?)\s*\)\s*\.\s*(toBe|toEqual|toStrictEqual)\s*\(\s*([\s\S]*?)\s*\)/g;

  let m;
  while ((m = re1.exec(code)) !== null) {
    tests.push({
      type: "equal",
      actual: m[1].trim(),
      expected: m[3].trim(),
    });
  }

  // ✅ toThrow
  const re2 =
    /expect\s*\(\s*\(\s*\)\s*=>\s*([\s\S]*?)\s*\)\s*\.\s*toThrow\s*\(\s*\)/g;

  while ((m = re2.exec(code)) !== null) {
    tests.push({
      type: "throw",
      actual: m[1].trim(),
    });
  }

  if (tests.length === 0) {
    return `console.log("No tests found");process.exit(0);`;
  }

  let runner = `
(function () {
  let passed = 0;
  let failed = 0;

  console.log("Running tests...\\n");
`;

  tests.forEach((t, i) => {
    if (t.type === "equal") {
      runner += `
  try {
    const actual = (${t.actual});
    const expected = (${t.expected});

    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(
        "Expected " + JSON.stringify(expected) +
        " but got " + JSON.stringify(actual)
      );
    }

    console.log("TEST ${i + 1}: PASS ✓");
    passed++;
  } catch (e) {
    console.log("TEST ${i + 1}: FAIL ✗");
    console.log("  Error:", e.message);
    failed++;
  }
`;
    }

    if (t.type === "throw") {
      runner += `
  try {
    let threw = false;
    try {
      ${t.actual};
    } catch (e) {
      threw = true;
    }

    if (!threw) {
      throw new Error("Expected function to throw");
    }

    console.log("TEST ${i + 1}: PASS ✓");
    passed++;
  } catch (e) {
    console.log("TEST ${i + 1}: FAIL ✗");
    console.log("  Error:", e.message);
    failed++;
  }
`;
    }
  });

  runner += `
  console.log("\\n========================================");
  console.log("Results:", passed, "passed,", failed, "failed");
  console.log("========================================");

  if (failed > 0) process.exit(1);
})();
`;

  return runner;
}

async function findJsTestFile(exerciseDir, exerciseSlug) {
  const meta = await readMetaConfig(exerciseDir);
  const testFiles = meta?.files?.test || [];

  for (const pat of testFiles) {
    const fileName = applySlugPattern(exerciseSlug, pat);
    const p = path.join(exerciseDir, fileName);
    if (fsSync.existsSync(p)) return p;
  }

  const candidates = [
    path.join(exerciseDir, `${exerciseSlug}.spec.js`),
    path.join(exerciseDir, `${exerciseSlug}.test.js`),
  ];

  for (const p of candidates) {
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
  try {
    const exerciseDir = await findExerciseDir(track, category, exerciseSlug);
    if (!exerciseDir) return errorSubmission("Exercise not found");

    let rawTest = "";
    const testFilePath = await findJsTestFile(exerciseDir, exerciseSlug);

    if (testFilePath) {
      rawTest = await fs.readFile(testFilePath, "utf-8");
    }

    const testCode = rawTest
      ? convertJestToPlainJS(rawTest)
      : makeNoTestsRunner();

    const combinedCode = `${cleanUserJS(userCode)}\n\n${testCode}`;

    const result = await http.post("/execute", {
      language: "javascript",
      version: "18.15.0",
      files: [{ name: "main.js", content: combinedCode }],
      stdin: stdin || "",
    });

    const stdout = result.data.run?.stdout || "";
    const exitCode = result.data.run?.code ?? 0;

    const testResults = parseTestLines(stdout);

    return {
      success: true,
      submission: {
        result: {
          status: exitCode === 0 ? "Accepted" : "Wrong Answer",
          stdout,
          stderr: result.data.run?.stderr || "",
          compileOutput: null,
          time: ((result.data.run?.time || 0) / 1000).toFixed(3),
          memory: result.data.run?.memory || 0,
        },
        passed: exitCode === 0,
        testResults,
      },
    };
  } catch (e) {
    return errorSubmission(e.message);
  }
}