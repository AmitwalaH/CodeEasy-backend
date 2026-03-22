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
  return `(function(){console.log("No tests available");process.exit(0);})();`;
}

function indentBlock(text, spaces) {
  const pad = " ".repeat(spaces);
  return text.split("\n").map((l) => (l.trim() ? pad + l : l)).join("\n");
}

function escapeForTemplate(s) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");
}

function extractBlockContent(code, startIdx) {
  let depth = 1;
  let i = startIdx;
  while (i < code.length && depth > 0) {
    if (code[i] === "{") depth++;
    else if (code[i] === "}") depth--;
    i++;
  }
  return { content: code.slice(startIdx, i - 1), endIdx: i };
}

function getAllDescribeBlocks(code) {
  const blocks = [];
  const re = /describe\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const { content } = extractBlockContent(code, m.index + m[0].length);
    blocks.push({ name: m[1], body: content });
  }
  return blocks;
}

function extractTestBlocks(code) {
  const tests = [];
  const re = /(?:test|it)\s*\(\s*['"`]([^'"`]+)['"`]\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    const { content } = extractBlockContent(code, m.index + m[0].length);
    tests.push({ name: m[1], body: content });
  }
  return tests;
}

function extractTopLevelCode(code) {
  // Get code outside describe blocks
  let result = code;
  // Remove imports
  result = result.replace(/^\s*import\s+[\s\S]*?;\s*$/gm, "");
  // Remove describe blocks
  const re = /describe\s*\(\s*['"`][^'"`]+['"`]\s*,\s*(?:async\s*)?\(\s*\)\s*=>\s*\{/g;
  let m;
  let lastResult = result;
  while ((m = re.exec(lastResult)) !== null) {
    const { content, endIdx } = extractBlockContent(lastResult, m.index + m[0].length);
    const fullBlock = lastResult.slice(m.index, endIdx + 1);
    result = result.replace(fullBlock, "");
    lastResult = result;
    re.lastIndex = 0;
  }
  return result.trim();
}

function buildExpectHelper() {
  return `function expect(actual){
  return {
    toBe(e){if(actual!==e)throw new Error("Expected "+JSON.stringify(e)+" but got "+JSON.stringify(actual));},
    toEqual(e){if(JSON.stringify(actual)!==JSON.stringify(e))throw new Error("Expected "+JSON.stringify(e)+" but got "+JSON.stringify(actual));},
    toStrictEqual(e){if(JSON.stringify(actual)!==JSON.stringify(e))throw new Error("Expected "+JSON.stringify(e)+" but got "+JSON.stringify(actual));},
    toBeNull(){if(actual!==null)throw new Error("Expected null but got "+JSON.stringify(actual));},
    toBeUndefined(){if(actual!==undefined)throw new Error("Expected undefined but got "+JSON.stringify(actual));},
    toBeDefined(){if(actual===undefined)throw new Error("Expected defined value");},
    toBeTruthy(){if(!actual)throw new Error("Expected truthy but got "+JSON.stringify(actual));},
    toBeFalsy(){if(actual)throw new Error("Expected falsy but got "+JSON.stringify(actual));},
    toContain(i){if(!actual.includes(i))throw new Error("Expected to contain "+JSON.stringify(i));},
    toHaveLength(l){if(actual.length!==l)throw new Error("Expected length "+l+" got "+actual.length);},
    toBeGreaterThan(n){if(!(actual>n))throw new Error("Expected "+actual+" > "+n);},
    toBeLessThan(n){if(!(actual<n))throw new Error("Expected "+actual+" < "+n);},
    toBeGreaterThanOrEqual(n){if(!(actual>=n))throw new Error("Expected "+actual+" >= "+n);},
    toBeLessThanOrEqual(n){if(!(actual<=n))throw new Error("Expected "+actual+" <= "+n);},
    toMatch(p){if(!String(actual).match(p))throw new Error("Expected to match "+p);},
    toThrow(){let t=false;try{actual();}catch(e){t=true;}if(!t)throw new Error("Expected to throw");},
    toThrowError(m){let t=false;try{actual();}catch(e){t=true;}if(!t)throw new Error("Expected to throw");},
    not:{
      toBe(e){if(actual===e)throw new Error("Expected not "+JSON.stringify(e));},
      toEqual(e){if(JSON.stringify(actual)===JSON.stringify(e))throw new Error("Expected not equal to "+JSON.stringify(e));},
      toBeNull(){if(actual===null)throw new Error("Expected not null");},
      toBeUndefined(){if(actual===undefined)throw new Error("Expected not undefined");},
      toBeTruthy(){if(actual)throw new Error("Expected not truthy");},
      toBeFalsy(){if(!actual)throw new Error("Expected not falsy");},
      toContain(i){if(actual.includes(i))throw new Error("Expected not to contain "+JSON.stringify(i));},
      toThrow(){try{actual();}catch(e){throw new Error("Expected not to throw");}},
    }
  };
}`;
}

function convertJestToPlainJS(jestCode) {
  let code = String(jestCode);
  code = code.replace(/^\s*import\s+[\s\S]*?;\s*$/gm, "");

  const describeBlocks = getAllDescribeBlocks(code);
  const topLevelCode = extractTopLevelCode(code);

  if (describeBlocks.length === 0) return makeNoTestsRunner();

  const lines = [];
  lines.push(buildExpectHelper());
  lines.push(``);

  // Add top-level functions/variables (like testTickets)
  if (topLevelCode) {
    lines.push(`// Top-level helpers`);
    lines.push(topLevelCode);
    lines.push(``);
  }

  lines.push(`function __runTests__() {`);
  lines.push(`  let passedCount = 0;`);
  lines.push(`  let failedCount = 0;`);

  for (const block of describeBlocks) {
    const tests = extractTestBlocks(block.body);

    // Get describe-level vars (before first test)
    const firstTestIdx = block.body.search(/(?:test|it)\s*\(/);
    const describeVars = firstTestIdx > 0
      ? block.body.slice(0, firstTestIdx).trim()
      : "";

    lines.push(`  // Suite: ${block.name}`);
    lines.push(`  console.log("\\nSuite: ${escapeForTemplate(block.name)}");`);

    // Add describe-level variables
    if (describeVars) {
      lines.push(indentBlock(describeVars, 2));
    }

    for (const test of tests) {
      lines.push(`  try {`);
      lines.push(indentBlock(test.body.trim(), 4));
      lines.push(`    console.log("TEST: ${escapeForTemplate(test.name)} - PASS ok");`);
      lines.push(`    passedCount++;`);
      lines.push(`  } catch (error) {`);
      lines.push(`    console.log("TEST: ${escapeForTemplate(test.name)} - FAIL xx");`);
      lines.push(`    console.log("  Error:", error?.message || String(error));`);
      lines.push(`    failedCount++;`);
      lines.push(`  }`);
    }
  }

  lines.push(`  console.log("\\n" + "=".repeat(40));`);
  lines.push(`  console.log("Results:", passedCount, "passed,", failedCount, "failed");`);
  lines.push(`  console.log("=".repeat(40));`);
  lines.push(`  if (failedCount > 0) process.exit(1);`);
  lines.push(`}`);
  lines.push(`__runTests__();`);

  return lines.join("\n");
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

    console.log("=== JS COMBINED CODE ===");
    console.log(combinedCode.slice(0, 500));
    console.log("========================");

    const payload = {
      language: "javascript",
      version: "18.15.0",
      files: [{ name: "main.js", content: combinedCode }],
      stdin: stdin || "",
    };

    const result = await http.post("/execute", payload);
    const output = result.data;

    console.log("=== JS PISTON OUTPUT ===");
    console.log("stdout:", output.run?.stdout?.slice(0, 500));
    console.log("stderr:", output.run?.stderr?.slice(0, 300));
    console.log("code:", output.run?.code);
    console.log("========================");

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
    console.error("=== JS RUNNER ERROR ===");
    console.error(e?.message);
    console.error(e?.response?.data);
    return errorSubmission(e?.message || "JavaScript runner failed");
  }
}