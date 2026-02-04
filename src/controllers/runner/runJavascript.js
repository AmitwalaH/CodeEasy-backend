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

function extractExpects(body) {
  const out = [];

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

  const re2 =
    /expect\s*\(\s*\(\s*\)\s*=>\s*([\s\S]*?)\s*\)\s*\.\s*toThrow\s*\(\s*\)\s*;?/g;
  while ((m = re2.exec(body)) !== null) {
    out.push({ actual: m[1].trim(), matcher: "toThrow", expected: null });
  }

  return out;
}

function convertJestToPlainJS(jestCode) {
  let code = String(jestCode);

  code = code.replace(/^\s*import\s+[\s\S]*?;\s*$/gm, "");

  code = code.replace(
    /(?:xtest|xit)\s*\(\s*['"`][\s\S]*?['"`]\s*,\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*\)\s*;?/g,
    "",
  );

  code = code.replace(
    /describe\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\(\)\s*=>\s*\{/,
    (_m, suite) => `
function __runTests__() {
  let passedCount = 0;
  let failedCount = 0;
  console.log("Running tests...");
  console.log("Suite: ${escapeForTemplate(String(suite))}\\n");
`,
  );

  code = code.replace(
    /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*\)\s*;?/g,
    (_m, testName, body) => {
      const expects = extractExpects(String(body));

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
        .map((ex) => {
          if (ex.matcher === "toThrow") {
            return `
    {
      let __threw__ = false;
      try { (${ex.actual}); } catch { __threw__ = true; }
      if (!__threw__) throw new Error("Expected function to throw");
    }
`;
          }

          return `
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
    },
  );

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
      try {
        rawTest = await fs.readFile(testFilePath, "utf-8");
      } catch {
        rawTest = "";
      }
    }

    const testCode = rawTest
      ? convertJestToPlainJS(rawTest)
      : makeNoTestsRunner();
    const combinedCode = `${cleanUserJS(userCode)}\n\n${testCode}`;

    const payload = {
      language: "javascript",
      version: "18.15.0",
      files: [{ name: "main.js", content: combinedCode }],
      stdin: stdin || "",
    };

    const result = await http.post("/execute", payload);
    const output = result.data;

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
  } catch (e) {
    return errorSubmission(e?.message || "JavaScript runner failed");
  }
}
