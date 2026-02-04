import path from "path";
import fs from "fs/promises";
import {
  http,
  getRuntime,
  findExerciseDir,
  parseTestLines,
  errorSubmission,
} from "./common.js";

function minimalCatchJsStyle() {
  return `
#include <iostream>
#include <string>
#include <stdexcept>
#include <sstream>
#include <vector>

namespace Catch {
  struct TestCase { std::string name; void (*func)(); };
  static std::vector<TestCase> tests;
  static int failures = 0;

  void registerTest(const std::string& name, void (*func)()) {
    tests.push_back({name, func});
  }

  int runAllTests() {
    for (auto& test : tests) {
      try {
        test.func();
        std::cout << "TEST: " << test.name << " - PASS \\xE2\\x9C\\x93" << std::endl;
      } catch (const std::exception& e) {
        std::cout << "TEST: " << test.name << " - FAIL \\xE2\\x9C\\x97" << std::endl;
        std::cout << "  Error: " << e.what() << std::endl;
        failures++;
      } catch (...) {
        std::cout << "TEST: " << test.name << " - FAIL \\xE2\\x9C\\x97" << std::endl;
        std::cout << "  Error: Unknown error" << std::endl;
        failures++;
      }
    }
    return failures;
  }
}

#define CONCAT_IMPL(x, y) x##y
#define CONCAT(x, y) CONCAT_IMPL(x, y)
#define GET_3RD_ARG(a1, a2, a3, ...) a3

// Support both: TEST_CASE("name") and TEST_CASE("name", "[tag]")
#define TEST_CASE1(name) \\
  void CONCAT(test_func_, __LINE__)(); \\
  namespace { \\
    struct CONCAT(TestRegistrar_, __LINE__) { \\
      CONCAT(TestRegistrar_, __LINE__)() { Catch::registerTest(name, CONCAT(test_func_, __LINE__)); } \\
    } CONCAT(registrar_, __LINE__); \\
  } \\
  void CONCAT(test_func_, __LINE__)()

#define TEST_CASE2(name, tags) TEST_CASE1(name)
#define TEST_CASE(...) GET_3RD_ARG(__VA_ARGS__, TEST_CASE2, TEST_CASE1)(__VA_ARGS__)

#define REQUIRE(expr) \\
  do { \\
    if (!(expr)) { \\
      std::stringstream ss; \\
      ss << "REQUIRE failed: " << #expr; \\
      throw std::runtime_error(ss.str()); \\
    } \\
  } while (0)
`.trim();
}

function stripAllPreprocessorLines(content) {
  return String(content || "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
}

async function loadCppTestFile(exerciseDir, baseName) {
  const patterns = [
    `${baseName}_test.cpp`,
    `test_${baseName}.cpp`,
    `${baseName}-test.cpp`,
    `${baseName}_tests.cpp`,
  ];

  for (const p of patterns) {
    try {
      const full = path.join(exerciseDir, p);
      const raw = await fs.readFile(full, "utf8");
      return raw;
    } catch {}
  }
  return "";
}

export async function runCpp({
  track,
  category,
  exerciseSlug,
  userCode,
  stdin,
}) {
  try {
    const exerciseDir = await findExerciseDir(track, category, exerciseSlug);
    if (!exerciseDir) return errorSubmission("Exercise not found");

    let rt = await getRuntime("c++");
    if (!rt?.version) rt = await getRuntime("cpp");
    if (!rt?.version) return errorSubmission("C++ runtime not found in Piston");

    const baseName = exerciseSlug.replace(/-/g, "_");
    const headerPath = path.join(exerciseDir, `${baseName}.h`);

    let headerContent = "";
    try {
      headerContent = await fs.readFile(headerPath, "utf8");
    } catch {}

    const testContent = await loadCppTestFile(exerciseDir, baseName);
    if (!testContent) return errorSubmission("C++ test file not found");

    const combinedCpp = `
${minimalCatchJsStyle()}

${stripAllPreprocessorLines(headerContent)}

${stripAllPreprocessorLines(userCode)}

${stripAllPreprocessorLines(testContent)}

int main() {
  return Catch::runAllTests();
}
`.trim();

    const payload = {
      language: rt.language,
      version: String(rt.version),
      files: [{ name: "main.cpp", content: combinedCpp }],
      stdin: stdin || "",
      compile_timeout: 10000,
    };

    const r = await http.post("/execute", payload);
    const output = r.data;

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
          compileOutput: output.compile?.stderr || null,
          time: ((output.run?.time || 0) / 1000).toFixed(3),
          memory: output.run?.memory || 0,
        },
        passed: allPassed,
        testResults,
      },
    };
  } catch (e) {
    return errorSubmission(e?.message || "C++ runner failed");
  }
}
