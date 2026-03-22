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

function pythonRunner(testFile) {
  return `
import sys
import unittest
import importlib.util
import os
import io

# 🔥 FAKE PYTEST (fix)
import types
pytest = types.SimpleNamespace()

def raises(exc):
    class Ctx:
        def __enter__(self): return self
        def __exit__(self, exc_type, exc_val, tb):
            return isinstance(exc_val, exc)
    return Ctx()

pytest.raises = raises
sys.modules['pytest'] = pytest


def load_module_from_file(file_path):
    file_path = os.path.abspath(file_path)
    mod_name = os.path.splitext(os.path.basename(file_path))[0]
    spec = importlib.util.spec_from_file_location(mod_name, file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class JsStyleResult(unittest.TextTestResult):
    def addSuccess(self, test):
        super().addSuccess(test)
        name = getattr(test, "_testMethodName", str(test))
        print(f"TEST: {name} - PASS ✓")

    def _fail_line(self, test, err):
        name = getattr(test, "_testMethodName", str(test))
        print(f"TEST: {name} - FAIL ✗")
        try:
            msg = self._exc_info_to_string(err, test)
        except Exception:
            msg = str(err)

        msg = (msg or "").strip().split("\\n")[-1]
        if msg:
            print("  Error:", msg)

    def addFailure(self, test, err):
        super().addFailure(test, err)
        self._fail_line(test, err)

    def addError(self, test, err):
        super().addError(test, err)
        self._fail_line(test, err)


class JsStyleRunner(unittest.TextTestRunner):
    resultclass = JsStyleResult


def main():
    test_path = "${testFile}"

    if not os.path.exists(test_path):
        print("TEST: discovery - FAIL ✗")
        print("  Error: Test file not found")
        sys.exit(1)

    try:
        test_module = load_module_from_file(test_path)
    except Exception as e:
        print("TEST: import - FAIL ✗")
        print("  Error:", str(e))
        sys.exit(1)

    suite = unittest.defaultTestLoader.loadTestsFromModule(test_module)

    if suite.countTestCases() == 0:
        print("TEST: discovery - FAIL ✗")
        print("  Error: No tests discovered")
        sys.exit(1)

    silent_stream = io.StringIO()
    runner = JsStyleRunner(stream=silent_stream, verbosity=0)
    result = runner.run(suite)

    sys.exit(0 if result.wasSuccessful() else 1)


if __name__ == "__main__":
    main()
`.trim();
}

async function findPythonFiles(exerciseDir, slug) {
  const meta = await readMetaConfig(exerciseDir);
  const snake = slug.replace(/-/g, "_");

  let solution = `${snake}.py`;
  let test = `${snake}_test.py`;

  if (meta?.files?.solution?.length) {
    solution = applySlugPattern(slug, meta.files.solution[0]);
  }
  if (meta?.files?.test?.length) {
    test = applySlugPattern(slug, meta.files.test[0]);
  }

  return {
    solution,
    test,
    testPath: path.join(exerciseDir, test),
  };
}

export async function runPython({
  track,
  category,
  exerciseSlug,
  userCode,
  stdin,
}) {
  const exerciseDir = await findExerciseDir(track, category, exerciseSlug);
  if (!exerciseDir) return { success: false, error: "Exercise not found" };

  const rt = await getRuntime("python");
  const version = String(rt?.version || "3.10.0");

  const { solution, test, testPath } = await findPythonFiles(
    exerciseDir,
    exerciseSlug,
  );

  if (!fsSync.existsSync(testPath)) {
    return { success: false, error: "Python test file not found" };
  }

  const testContent = await fs.readFile(testPath, "utf8");

  const files = [
    { name: "main.py", content: pythonRunner(test) },
    { name: solution, content: String(userCode || "") },
    { name: test, content: String(testContent || "") },
  ];

  const payload = {
    language: "python",
    version,
    files,
    stdin: stdin || "",
  };

  const r = await http.post("/execute", payload);
  const out = r.data;

  const stdout = out.run?.stdout || "";
  const exitCode = out.run?.code ?? 0;

  const testResults = parseTestLines(stdout);
  const allPassed = testResults.length
    ? testResults.every((t) => t.passed)
    : exitCode === 0;

  return {
    success: true,
    submission: {
      result: {
        status: allPassed ? "Accepted" : "Wrong Answer",
        stdout,
        stderr: "",
        compileOutput: null,
        time: ((out.run?.time || 0) / 1000).toFixed(3),
        memory: out.run?.memory || 0,
      },
      passed: allPassed,
      testResults: testResults.length
        ? testResults
        : [
            {
              input: "Execution",
              expectedOutput: "Success",
              actualOutput: exitCode === 0 ? "Success" : "Failed",
              passed: exitCode === 0,
            },
          ],
    },
  };
}