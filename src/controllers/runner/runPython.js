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

async function findPythonFiles(exerciseDir, exerciseSlug) {
  const meta = await readMetaConfig(exerciseDir);

  const solutionPatterns = meta?.files?.solution || [];
  const testPatterns = meta?.files?.test || [];

  const found = {
    solutionName: null,
    testName: null,
    testPath: null,
  };

  for (const pat of solutionPatterns) {
    const name = applySlugPattern(exerciseSlug, pat);
    const p = path.join(exerciseDir, name);
    if (fsSync.existsSync(p)) {
      found.solutionName = name;
      break;
    }
  }

  for (const pat of testPatterns) {
    const name = applySlugPattern(exerciseSlug, pat);
    const p = path.join(exerciseDir, name);
    if (fsSync.existsSync(p)) {
      found.testName = name;
      found.testPath = p;
      break;
    }
  }

  const snake = exerciseSlug.replace(/-/g, "_");
  if (!found.solutionName) {
    const p = path.join(exerciseDir, `${snake}.py`);
    if (fsSync.existsSync(p)) found.solutionName = `${snake}.py`;
  }
  if (!found.testName) {
    const p = path.join(exerciseDir, `${snake}_test.py`);
    if (fsSync.existsSync(p)) {
      found.testName = `${snake}_test.py`;
      found.testPath = p;
    }
  }

  return found;
}

// ✅ python runner prints: TEST: name - PASS/FAIL
function makePythonRunner(testFileName) {
  return `
import sys
import os
import unittest

# allow importing hello_world.py etc
sys.path.insert(0, os.path.abspath("."))

class JsStyleResult(unittest.TextTestResult):
    def addSuccess(self, test):
        super().addSuccess(test)
        name = getattr(test, "_testMethodName", str(test))
        print(f"TEST: {name} - PASS ✓")

    def _fail(self, test, err):
        name = getattr(test, "_testMethodName", str(test))
        print(f"TEST: {name} - FAIL ✗")
        msg = self._exc_info_to_string(err, test).strip().split("\\n")[-1]
        if msg:
            print("  Error:", msg)

    def addFailure(self, test, err):
        super().addFailure(test, err)
        self._fail(test, err)

    def addError(self, test, err):
        super().addError(test, err)
        self._fail(test, err)

class JsStyleRunner(unittest.TextTestRunner):
    resultclass = JsStyleResult

def main():
    loader = unittest.TestLoader()

    # discover ONLY this test file
    suite = loader.discover(".", pattern="${testFileName}")

    runner = JsStyleRunner(verbosity=0)
    result = runner.run(suite)

    # IMPORTANT: if 0 tests => fail (no fake pass)
    if result.testsRun == 0:
        print("TEST: discovery - FAIL ✗")
        print("  Error: No tests discovered")
        sys.exit(1)

    sys.exit(0 if result.wasSuccessful() else 1)

if __name__ == "__main__":
    main()
`.trim();
}

export async function runPython({
  track,
  category,
  exerciseSlug,
  userCode,
  stdin,
}) {
  const exerciseDir = await findExerciseDir(track, category, exerciseSlug);
  if (!exerciseDir) return { success: false, error: `Exercise not found` };

  const rt = await getRuntime("python");
  const version = rt?.version ? String(rt.version) : "3.10.0";

  const found = await findPythonFiles(exerciseDir, exerciseSlug);
  if (!found.solutionName)
    return { success: false, error: "Python solution file not found" };
  if (!found.testName || !found.testPath)
    return { success: false, error: "Python test file not found" };

  const testContent = await fs.readFile(found.testPath, "utf8");
  const runner = makePythonRunner(found.testName);

  const files = [
    { name: found.solutionName, content: String(userCode || "") },
    { name: found.testName, content: String(testContent || "") },
    { name: "main.py", content: runner },
  ];

  const payload = {
    language: "python",
    version,
    files,
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
