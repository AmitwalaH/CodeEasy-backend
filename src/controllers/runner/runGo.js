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

async function findGoFiles(exerciseDir, slug) {
  const meta = await readMetaConfig(exerciseDir);
  const snake = slug.replace(/-/g, "_");

  let solution = `${snake}.go`;

  if (meta?.files?.solution?.length) {
    solution = applySlugPattern(slug, meta.files.solution[0]);
  }

  // Find ALL _test.go files
  const allFiles = fsSync.readdirSync(exerciseDir);
  const testFiles = allFiles.filter(f => f.endsWith("_test.go"));

  return { solution, testFiles };
}

function extractGoTestFunctions(testContent) {
  const functions = [];
  const lines = testContent.split("\n");
  let currentFunc = null;
  let currentBody = [];
  let depth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!currentFunc) {
      const match = trimmed.match(/^func\s+(Test\w+)\s*\(\s*t\s+\*testing\.T\s*\)/);
      if (match) {
        currentFunc = match[1];
        currentBody = [];
        depth = 0;
        if (trimmed.includes("{")) depth = 1;
      }
    } else {
      for (const ch of line) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }
      if (depth <= 0) {
        functions.push({ name: currentFunc, body: currentBody.join("\n") });
        currentFunc = null;
        currentBody = [];
        depth = 0;
      } else {
        currentBody.push(line);
      }
    }
  }

  return functions;
}

function extractGoDataStructures(testContent) {
  // Extract var declarations (testCases etc) outside functions
  const lines = testContent.split("\n");
  const dataLines = [];
  let inFunc = false;
  let depth = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(/^func\s+/)) {
      inFunc = true;
      depth = 0;
    }
    if (inFunc) {
      for (const ch of line) {
        if (ch === "{") depth++;
        if (ch === "}") depth--;
      }
      if (depth <= 0) inFunc = false;
    } else {
      // Not in a function - keep data declarations
      if (!trimmed.startsWith("package ") &&
          !trimmed.startsWith("import ") &&
          !trimmed.startsWith("//") &&
          trimmed !== "") {
        dataLines.push(line);
      }
    }
  }

  return dataLines.join("\n");
}

function buildGoRunner(userCode, allTestContent, exerciseSlug) {
  const cleanUserCode = String(userCode || "").trim();

  const testFuncs = extractGoTestFunctions(allTestContent);
  const dataStructures = extractGoDataStructures(allTestContent);

  console.log("Go test functions found:", testFuncs.length);

  const solutionCode = cleanUserCode
    .replace(/^package\s+\w+\s*\n/m, "")
    .replace(/^import\s+\([\s\S]*?\)\s*\n/m, "")
    .replace(/^import\s+"[^"]*"\s*\n/gm, "")
    .trim();

  const lines = [];
  lines.push(`package main`);
  lines.push(``);
  lines.push(`import (`);
  lines.push(`  "fmt"`);
  lines.push(`  "math"`);
  lines.push(`  "strings"`);
  lines.push(`  "strconv"`);
  lines.push(`  "sort"`);
  lines.push(`  "errors"`);
  lines.push(`  "reflect"`);
  lines.push(`)`);
  lines.push(``);
  lines.push(`var _ = fmt.Sprintf`);
  lines.push(`var _ = math.Abs`);
  lines.push(`var _ = strings.Contains`);
  lines.push(`var _ = strconv.Itoa`);
  lines.push(`var _ = sort.Ints`);
  lines.push(`var _ = errors.New`);
  lines.push(`var _ = reflect.DeepEqual`);
  lines.push(``);

  lines.push(`// Solution`);
  lines.push(solutionCode);
  lines.push(``);

  lines.push(`// Test data`);
  lines.push(dataStructures);
  lines.push(``);

  lines.push(`// Testing stub`);
  lines.push(`type testingT struct{ failed bool; name string }`);
  lines.push(`func (t *testingT) Errorf(format string, args ...interface{}) {`);
  lines.push(`  fmt.Printf("  Error: "+format+"\\n", args...)`);
  lines.push(`  t.failed = true`);
  lines.push(`}`);
  lines.push(`func (t *testingT) Error(args ...interface{}) {`);
  lines.push(`  fmt.Println("  Error:", fmt.Sprint(args...))`);
  lines.push(`  t.failed = true`);
  lines.push(`}`);
  lines.push(`func (t *testingT) Fatalf(format string, args ...interface{}) {`);
  lines.push(`  fmt.Printf("  Error: "+format+"\\n", args...)`);
  lines.push(`  t.failed = true`);
  lines.push(`}`);
  lines.push(`func (t *testingT) Fatal(args ...interface{}) {`);
  lines.push(`  fmt.Println("  Error:", fmt.Sprint(args...))`);
  lines.push(`  t.failed = true`);
  lines.push(`}`);
  lines.push(`func (t *testingT) Log(args ...interface{}) {}`);
  lines.push(`func (t *testingT) Logf(format string, args ...interface{}) {}`);
  lines.push(`func (t *testingT) Skip(args ...interface{}) {}`);
  lines.push(`func (t *testingT) Skipf(format string, args ...interface{}) {}`);
  lines.push(`func (t *testingT) Helper() {}`);
  lines.push(`func (t *testingT) Run(name string, f func(*testingT)) bool {`);
  lines.push(`  sub := &testingT{name: name}`);
  lines.push(`  f(sub)`);
  lines.push(`  if sub.failed { t.failed = true }`);
  lines.push(`  return !sub.failed`);
  lines.push(`}`);
  lines.push(``);

  if (testFuncs.length > 0) {
    for (const tf of testFuncs) {
      lines.push(`func ${tf.name}(t *testingT) {`);
      lines.push(tf.body);
      lines.push(`}`);
      lines.push(``);
    }

    lines.push(`func main() {`);
    lines.push(`  failures := 0`);
    for (const tf of testFuncs) {
      const testName = tf.name
        .replace(/^Test/, "")
        .replace(/([A-Z])/g, " $1")
        .trim()
        .toLowerCase();
      lines.push(`  {`);
      lines.push(`    t := &testingT{name: "${testName}"}`);
      lines.push(`    ${tf.name}(t)`);
      lines.push(`    if t.failed {`);
      lines.push(`      fmt.Println("TEST: ${testName} - FAIL xx")`);
      lines.push(`      failures++`);
      lines.push(`    } else {`);
      lines.push(`      fmt.Println("TEST: ${testName} - PASS ok")`);
      lines.push(`    }`);
      lines.push(`  }`);
    }
    lines.push(`  if failures > 0 {`);
    lines.push(`    fmt.Printf("%d test(s) failed\\n", failures)`);
    lines.push(`  }`);
    lines.push(`}`);
  } else {
    lines.push(`func main() {`);
    lines.push(`  fmt.Println("No tests found")`);
    lines.push(`}`);
  }

  return lines.join("\n");
}

export async function runGo({
  track,
  category,
  exerciseSlug,
  userCode,
  stdin,
}) {
  try {
    const exerciseDir = await findExerciseDir(track, category, exerciseSlug);
    if (!exerciseDir) return errorSubmission("Exercise not found");

    const rt = await getRuntime("go");
    if (!rt?.version) return errorSubmission("Go runtime not found");

    const { solution, testFiles } = await findGoFiles(
      exerciseDir,
      exerciseSlug
    );

    console.log("Go test files found:", testFiles);

    // Read ALL test files
    let allTestContent = "";
    for (const tf of testFiles) {
      const content = await fs.readFile(
        path.join(exerciseDir, tf),
        "utf8"
      );
      allTestContent += "\n" + content;
    }

    const mainGo = buildGoRunner(userCode, allTestContent, exerciseSlug);

    console.log("=== GO RUNNER ===");
    console.log("Exercise:", exerciseSlug);
    console.log("Runtime:", rt.version);
    console.log("Test files:", testFiles);
    console.log("=== GO MAIN (first 500 chars) ===");
    console.log(mainGo.slice(0, 500));

    const files = [
      { name: "main.go", content: mainGo },
    ];

    const payload = {
      language: "go",
      version: String(rt.version),
      files,
      stdin: stdin || "",
    };

    const r = await http.post("/execute", payload);
    const out = r.data;

    const stdout = out.run?.stdout || "";
    const stderr = out.run?.stderr || "";
    const compileStderr = out.compile?.stderr || "";
    const exitCode = out.run?.code ?? 0;

    console.log("=== GO OUTPUT ===");
    console.log("compile:", compileStderr?.slice(0, 500));
    console.log("stdout:", stdout?.slice(0, 300));
    console.log("code:", exitCode);

    if (out.compile && out.compile.code !== 0) {
      return {
        success: true,
        submission: {
          result: {
            status: "Compilation Error",
            stdout: "",
            stderr: compileStderr,
            compileOutput: compileStderr,
            time: "0",
            memory: 0,
          },
          passed: false,
          testResults: [{
            input: "Compilation",
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
          compileOutput: compileStderr || null,
          time: ((out.run?.time || 0) / 1000).toFixed(3),
          memory: out.run?.memory || 0,
        },
        passed: allPassed,
        testResults,
      },
    };
  } catch (e) {
    console.error("=== GO RUNNER ERROR ===", e?.message);
    return errorSubmission(e?.message || "Go runner failed");
  }
}