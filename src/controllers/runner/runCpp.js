import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import { http, getRuntime, findExerciseDir, parseTestLines } from "./common.js";

function minimalCatch() {
  return `
#include <iostream>
#include <string>
#include <vector>
#include <stdexcept>
#include <sstream>

namespace CatchMini {
  struct Test { std::string name; void (*fn)(); };
  static std::vector<Test> tests;

  void add(const std::string& name, void (*fn)()) {
    tests.push_back({name, fn});
  }

  int runAll() {
    int fails = 0;
    for (auto &t : tests) {
      try {
        t.fn();
        std::cout << "TEST: " << t.name << " - PASS \\xE2\\x9C\\x93" << std::endl;
      } catch (const std::exception& e) {
        std::cout << "TEST: " << t.name << " - FAIL \\xE2\\x9C\\x97" << std::endl;
        std::cout << "  Error: " << e.what() << std::endl;
        fails++;
      }
    }
    return fails;
  }
}

#define CONCAT2(a,b) a##b
#define CONCAT(a,b) CONCAT2(a,b)
#define GET_3RD(a,b,c,...) c

// support TEST_CASE("name") and TEST_CASE("name","[tag]")
#define TEST_CASE1(name) \\
  void CONCAT(test_, __LINE__)(); \\
  struct CONCAT(Reg_, __LINE__) { \\
    CONCAT(Reg_, __LINE__)() { CatchMini::add(name, CONCAT(test_, __LINE__)); } \\
  } CONCAT(reg_, __LINE__); \\
  void CONCAT(test_, __LINE__)()

#define TEST_CASE2(name, tags) TEST_CASE1(name)
#define TEST_CASE(...) GET_3RD(__VA_ARGS__, TEST_CASE2, TEST_CASE1)(__VA_ARGS__)

#define REQUIRE(expr) do { \\
  if (!(expr)) { \\
    std::stringstream ss; ss << "REQUIRE failed: " << #expr; \\
    throw std::runtime_error(ss.str()); \\
  } \\
} while(0)
`.trim();
}

function removeAllPreprocessorLines(code) {
  return String(code || "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("#"))
    .join("\n");
}

async function findCppTestFile(exerciseDir, exerciseSlug) {
  const base = exerciseSlug.replace(/-/g, "_");
  const names = [
    `${base}_test.cpp`,
    `test_${base}.cpp`,
    `${base}-test.cpp`,
    `${base}_tests.cpp`,
  ];

  for (const n of names) {
    const p = path.join(exerciseDir, n);
    if (fsSync.existsSync(p)) return p;
  }
  return null;
}

export async function runCpp({
  track,
  category,
  exerciseSlug,
  userCode,
  stdin,
}) {
  const exerciseDir = await findExerciseDir(track, category, exerciseSlug);
  if (!exerciseDir) return { success: false, error: `Exercise not found` };

  let rt = await getRuntime("c++");
  if (!rt?.version) rt = await getRuntime("cpp");
  if (!rt?.version)
    return { success: false, error: "C++ runtime not found in Piston" };

  const base = exerciseSlug.replace(/-/g, "_");
  const headerPath = path.join(exerciseDir, `${base}.h`);
  const testPath = await findCppTestFile(exerciseDir, exerciseSlug);
  if (!testPath) return { success: false, error: "C++ test file not found" };

  let headerContent = "";
  try {
    headerContent = await fs.readFile(headerPath, "utf8");
  } catch {}
  const testContent = await fs.readFile(testPath, "utf8");

  const combined = `
${minimalCatch()}

${removeAllPreprocessorLines(headerContent)}

${removeAllPreprocessorLines(userCode)}

${removeAllPreprocessorLines(testContent)}

int main() {
  return CatchMini::runAll();
}
`.trim();

  const payload = {
    language: rt.language,
    version: String(rt.version),
    files: [{ name: "main.cpp", content: combined }],
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
}
