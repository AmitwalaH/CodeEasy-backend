import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import {
  http,
  getRuntime,
  findExerciseDir,
  readMetaConfig,
  applySlugPattern,
  parseTestLines,
  errorSubmission,
} from "./common.js";

async function findRFiles(exerciseDir, slug) {
  const meta = await readMetaConfig(exerciseDir);
  const snake = slug.replace(/-/g, "_");
  const kebab = slug;

  let solution = `${snake}.R`;
  let test = `test_${snake}.R`;

  if (meta?.files?.solution?.length) {
    solution = applySlugPattern(slug, meta.files.solution[0]);
  }
  if (meta?.files?.test?.length) {
    test = applySlugPattern(slug, meta.files.test[0]);
  }

  // Try different file name patterns
  const testCandidates = [
    test,
    `test_${snake}.R`,
    `test_${kebab}.R`,
    `${snake}_test.R`,
    `${kebab}-test.R`,
  ];

  for (const t of testCandidates) {
    const p = path.join(exerciseDir, t);
    if (fsSync.existsSync(p)) {
      return { solution, test: t, testPath: p };
    }
  }

  return { solution, test, testPath: path.join(exerciseDir, test) };
}

function buildRRunner(userCode, testContent, exerciseSlug) {
  const cleanUserCode = String(userCode || "")
    .replace(/^\s*source\s*\(.*?\)\s*$/gm, "")
    .replace(/^\s*library\s*\(.*?\)\s*$/gm, "")
    .trim();

  let cleanTest = String(testContent || "")
    .replace(/^\s*source\s*\(.*?\)\s*$/gm, "")
    .replace(/^\s*library\s*\(.*?\)\s*$/gm, "")
    .trim();

  // Convert test_that to run_test
  cleanTest = cleanTest.replace(
    /test_that\s*\(\s*["'](.*?)["']\s*,\s*\{/g,
    (_, name) => `run_test("${name}", {`
  );

  // Convert expect_equal to assert_equal
  cleanTest = cleanTest.replace(/expect_equal\s*\(/g, "assert_equal(");
  cleanTest = cleanTest.replace(/expect_true\s*\(/g, "assert_true(");
  cleanTest = cleanTest.replace(/expect_false\s*\(/g, "assert_false(");
  cleanTest = cleanTest.replace(/expect_null\s*\(/g, "assert_null(");
  cleanTest = cleanTest.replace(/expect_error\s*\(/g, "assert_error(");
  cleanTest = cleanTest.replace(/expect_match\s*\(/g, "assert_match_r(");

  const lines = [];

  lines.push(`failures <- 0`);
  lines.push(``);
  lines.push(`run_test <- function(name, code_block) {`);
  lines.push(`  tryCatch({`);
  lines.push(`    code_block`);
  lines.push(`    cat(paste0("TEST: ", name, " - PASS ok\\n"))`);
  lines.push(`  }, error = function(e) {`);
  lines.push(`    cat(paste0("TEST: ", name, " - FAIL xx\\n"))`);
  lines.push(`    cat(paste0("  Error: ", conditionMessage(e), "\\n"))`);
  lines.push(`    failures <<- failures + 1`);
  lines.push(`  })`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`assert_equal <- function(actual, expected, msg = NULL) {`);
  lines.push(`  if (!identical(actual, expected)) {`);
  lines.push(`    stop(paste0("Expected ", deparse(expected), " but got ", deparse(actual)))`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`assert_true <- function(value, msg = NULL) {`);
  lines.push(`  if (!isTRUE(value)) stop(if (!is.null(msg)) msg else "Expected TRUE")`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`assert_false <- function(value, msg = NULL) {`);
  lines.push(`  if (!isFALSE(value)) stop(if (!is.null(msg)) msg else "Expected FALSE")`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`assert_null <- function(value, msg = NULL) {`);
  lines.push(`  if (!is.null(value)) stop(paste0("Expected NULL but got ", deparse(value)))`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`assert_error <- function(expr, ...) {`);
  lines.push(`  tryCatch({ force(expr); stop("Expected error but none thrown") },`);
  lines.push(`    error = function(e) invisible(NULL))`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`assert_match_r <- function(actual, pattern, msg = NULL) {`);
  lines.push(`  if (!grepl(pattern, actual)) stop(paste0("Expected match for ", pattern))`);
  lines.push(`}`);
  lines.push(``);
  lines.push(`# User solution`);
  lines.push(cleanUserCode);
  lines.push(``);
  lines.push(`# Tests`);
  lines.push(cleanTest);
  lines.push(``);
  lines.push(`quit(status = if (failures > 0) 1 else 0)`);

  return lines.join("\n");
}

export async function runR({
  track,
  category,
  exerciseSlug,
  userCode,
  stdin,
}) {
  try {
    const exerciseDir = await findExerciseDir(track, category, exerciseSlug);
    if (!exerciseDir) return errorSubmission("Exercise not found");

    const rt = await getRuntime("rscript");
    if (!rt?.version) return errorSubmission("R runtime not found");

    const { solution, test, testPath } = await findRFiles(
      exerciseDir,
      exerciseSlug
    );

    console.log("=== R RUNNER ===");
    console.log("Exercise:", exerciseSlug);
    console.log("Solution:", solution);
    console.log("Test:", test);
    console.log("Test exists:", fsSync.existsSync(testPath));

    let testContent = "";
    if (fsSync.existsSync(testPath)) {
      testContent = await fs.readFile(testPath, "utf8");
    } else {
      return errorSubmission("R test file not found: " + test);
    }

    const mainR = buildRRunner(userCode, testContent, exerciseSlug);

    console.log("=== R MAIN (first 500 chars) ===");
    console.log(mainR.slice(0, 500));

    const files = [
      { name: "main.R", content: mainR },
    ];

    const payload = {
      language: "rscript",
      version: String(rt.version),
      files,
      stdin: stdin || "",
    };

    const r = await http.post("/execute", payload);
    const out = r.data;

    const stdout = out.run?.stdout || "";
    const stderr = out.run?.stderr || "";
    const exitCode = out.run?.code ?? 0;

    console.log("=== R OUTPUT ===");
    console.log("stdout:", stdout);
    console.log("stderr:", stderr?.slice(0, 300));
    console.log("code:", exitCode);

    if (!stdout && stderr) {
      return {
        success: true,
        submission: {
          result: {
            status: "Error",
            stdout: "",
            stderr: stderr,
            compileOutput: stderr,
            time: "0",
            memory: 0,
          },
          passed: false,
          testResults: [{
            input: "Error",
            expectedOutput: "Success",
            actualOutput: "Failed",
            passed: false,
          }],
        },
      };
    }

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
          stderr,
          compileOutput: null,
          time: ((out.run?.time || 0) / 1000).toFixed(3),
          memory: out.run?.memory || 0,
        },
        passed: allPassed,
        testResults,
      },
    };
  } catch (e) {
    console.error("=== R RUNNER ERROR ===", e?.message);
    return errorSubmission(e?.message || "R runner failed");
  }
}