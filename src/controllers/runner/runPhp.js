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
} from "./common.js";

// ----------------------
// helper: find PHP files
// ----------------------
async function findPhpFiles(exerciseDir, slug) {
  const meta = await readMetaConfig(exerciseDir);

  // defaults (many tracks use these)
  let solution = "HelloWorld.php";
  let test = "HelloWorldTest.php";

  // if meta exists, use it
  if (meta?.files?.solution?.length) {
    solution = applySlugPattern(slug, meta.files.solution[0]);
  }
  if (meta?.files?.test?.length) {
    test = applySlugPattern(slug, meta.files.test[0]);
  }

  const testPath = path.join(exerciseDir, test);

  return { solution, test, testPath };
}

// ----------------------
// helper: PHP JS-style runner
// - tries phpunit
// - if phpunit missing, fallback for hello-world
// ----------------------
function buildPhpMain({ testFile, solutionFile, exerciseSlug }) {
  // Fallback logic for hello-world (because phpunit may not exist in piston)
  const isHelloWorld =
    exerciseSlug === "hello-world" ||
    exerciseSlug.replace(/-/g, "_") === "hello_world";

  return `
<?php
// 1) Try phpunit first (if available)
$phpunit = trim((string) shell_exec("phpunit --version 2>/dev/null"));

if ($phpunit !== "") {
  // run phpunit on that test file
  $cmd = "phpunit --colors=never " . escapeshellarg("${testFile}") . " 2>&1";
  $out = shell_exec($cmd);
  echo $out;

  // if phpunit output contains "FAILURES!" => exit 1 else exit 0
  if (strpos($out, "FAILURES!") !== false || strpos($out, "ERRORS!") !== false) {
    exit(1);
  }
  exit(0);
}

// 2) No phpunit => fallback for hello-world
require "${solutionFile}";

function __test($name, $fn) {
  try {
    $fn();
    echo "TEST: " . $name . " - PASS ✓\\n";
    return true;
  } catch (Throwable $e) {
    echo "TEST: " . $name . " - FAIL ✗\\n";
    echo "  Error: " . $e->getMessage() . "\\n";
    return false;
  }
}

$allPassed = true;

if (${isHelloWorld ? "true" : "false"}) {
  echo "Running tests...\\n";
  echo "Suite: Hello World\\n\\n";
  
  $allPassed = __test("say hi", function() {
    if (!function_exists("helloWorld")) {
      throw new Exception("Missing function helloWorld()");
    }
    $got = helloWorld();
    if ($got !== "Hello, World!") {
      throw new Exception('Expected "Hello, World!" but got "' . $got . '"');
    }
  }) && $allPassed;
  
  echo "\\n" . str_repeat("=", 40) . "\\n";
  echo "Results: " . ($allPassed ? "1" : "0") . " passed, " . ($allPassed ? "0" : "1") . " failed\\n";
  echo str_repeat("=", 40) . "\\n";
} else {
  echo "TEST: runner - FAIL ✗\\n";
  echo "  Error: phpunit not available in Piston for this exercise\\n";
  $allPassed = false;
}

exit($allPassed ? 0 : 1);
`.trim();
}

// ----------------------
// MAIN
// ----------------------
export async function runPhp({
  track,
  category,
  exerciseSlug,
  userCode,
  stdin,
}) {
  console.log("=== RUN PHP ===");
  console.log("track:", track);
  console.log("category:", category);
  console.log("exerciseSlug:", exerciseSlug);

  const exerciseDir = await findExerciseDir(track, category, exerciseSlug);
  console.log("exerciseDir:", exerciseDir);

  if (!exerciseDir) return { success: false, error: "Exercise not found" };

  const rt = await getRuntime("php");
  const version = rt?.version || "8.2.3";
  console.log("php runtime version:", version);

  const { solution, test, testPath } = await findPhpFiles(
    exerciseDir,
    exerciseSlug,
  );

  console.log("solution file:", solution);
  console.log("test file:", test);
  console.log("testPath:", testPath);
  console.log("test exists:", fsSync.existsSync(testPath));

  // test missing => still allow fallback for hello-world
  let testContent = "";
  if (fsSync.existsSync(testPath)) {
    testContent = await fs.readFile(testPath, "utf8");
  }

  const mainPhp = buildPhpMain({
    testFile: test,
    solutionFile: solution,
    exerciseSlug,
  });

  // IMPORTANT: file order
  const files = [
    { name: "main.php", content: mainPhp },
    { name: solution, content: String(userCode || "") },
    { name: test, content: String(testContent || "") },
  ];

  console.log(
    "Payload files order:",
    files.map((f) => f.name),
  );

  const payload = {
    language: "php",
    version: String(version),
    files,
    stdin: stdin || "",
  };

  console.log("Sending to Piston (PHP)...");
  const r = await http.post("/execute", payload);
  const out = r.data;

  const stdout = out.run?.stdout || "";
  const stderr = out.run?.stderr || "";
  const exitCode = out.run?.code ?? 0;

  console.log("=== PISTON RESPONSE (PHP) ===");
  console.log("run code:", exitCode);
  console.log("run stdout:\n", stdout);
  console.log("run stderr:\n", stderr);

  // parse JS-style lines: "TEST: ... - PASS/FAIL"
  const testResults = parseTestLines(stdout);

  // if nothing parsed, still show Execution status
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
}
