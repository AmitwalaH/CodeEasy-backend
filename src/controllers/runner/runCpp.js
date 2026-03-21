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
#include <algorithm>
#include <cmath>
#include <map>
#include <set>
#include <unordered_map>
#include <unordered_set>
#include <functional>
#include <numeric>
#include <memory>
#include <optional>
#include <variant>
#include <tuple>
#include <array>
#include <cstdint>
#include <climits>
#include <cassert>
#include <regex>
#include <iterator>
#include <stdexcept>

namespace Catch {
  struct TestCase { std::string name; void (*func)(); };
  static std::vector<TestCase> tests;
  static int failures = 0;
  static std::string current_test = "";

  void registerTest(const std::string& name, void (*func)()) {
    tests.push_back({name, func});
  }

  namespace Matchers {
    struct WithinAbsMatcher {
      double target, margin;
      WithinAbsMatcher(double t, double m) : target(t), margin(m) {}
      bool match(double val) const {
        return std::fabs(val - target) <= margin;
      }
    };
    inline WithinAbsMatcher WithinAbs(double target, double margin) {
      return WithinAbsMatcher(target, margin);
    }

    struct WithinRelMatcher {
      double target, margin;
      WithinRelMatcher(double t, double m) : target(t), margin(m) {}
      bool match(double val) const {
        return std::fabs(val - target) <= margin * std::fabs(target);
      }
    };
    inline WithinRelMatcher WithinRel(double target, double margin = 1e-6) {
      return WithinRelMatcher(target, margin);
    }

    struct ContainsMatcher {
      std::string expected;
      ContainsMatcher(const std::string& s) : expected(s) {}
      bool match(const std::string& val) const {
        return val.find(expected) != std::string::npos;
      }
    };
    inline ContainsMatcher Contains(const std::string& s) {
      return ContainsMatcher(s);
    }

    struct StartsWithMatcher {
      std::string expected;
      StartsWithMatcher(const std::string& s) : expected(s) {}
      bool match(const std::string& val) const {
        return val.rfind(expected, 0) == 0;
      }
    };
    inline StartsWithMatcher StartsWith(const std::string& s) {
      return StartsWithMatcher(s);
    }

    struct EndsWithMatcher {
      std::string expected;
      EndsWithMatcher(const std::string& s) : expected(s) {}
      bool match(const std::string& val) const {
        if (val.size() < expected.size()) return false;
        return val.compare(val.size() - expected.size(), expected.size(), expected) == 0;
      }
    };
    inline EndsWithMatcher EndsWith(const std::string& s) {
      return EndsWithMatcher(s);
    }
  }

  int runAllTests() {
    for (auto& test : tests) {
      current_test = test.name;
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

#define SECTION(name) if(true)
#define GIVEN(desc) if(true)
#define WHEN(desc) if(true)
#define THEN(desc) if(true)
#define AND_WHEN(desc) if(true)
#define AND_THEN(desc) if(true)

#define REQUIRE(expr) \\
  do { \\
    if (!(expr)) { \\
      std::stringstream ss; \\
      ss << "REQUIRE failed: " << #expr; \\
      throw std::runtime_error(ss.str()); \\
    } \\
  } while (0)

#define CHECK(expr) \\
  do { \\
    if (!(expr)) { \\
      std::stringstream ss; \\
      ss << "CHECK failed: " << #expr; \\
      throw std::runtime_error(ss.str()); \\
    } \\
  } while (0)

#define REQUIRE_FALSE(expr) \\
  do { \\
    if (expr) { \\
      std::stringstream ss; \\
      ss << "REQUIRE_FALSE failed: " << #expr; \\
      throw std::runtime_error(ss.str()); \\
    } \\
  } while (0)

#define CHECK_FALSE(expr) REQUIRE_FALSE(expr)

#define REQUIRE_THROWS(expr) \\
  do { \\
    bool _threw = false; \\
    try { expr; } catch (...) { _threw = true; } \\
    if (!_threw) { \\
      throw std::runtime_error("Expected exception but none was thrown"); \\
    } \\
  } while (0)

#define REQUIRE_THROWS_AS(expr, extype) \\
  do { \\
    bool _threw = false; \\
    try { expr; } catch (const extype&) { _threw = true; } catch (...) {} \\
    if (!_threw) { \\
      throw std::runtime_error("Expected exception of specific type"); \\
    } \\
  } while (0)

#define REQUIRE_THROWS_WITH(expr, msg) REQUIRE_THROWS(expr)
#define CHECK_THROWS(expr) REQUIRE_THROWS(expr)
#define CHECK_THROWS_AS(expr, extype) REQUIRE_THROWS_AS(expr, extype)
#define CHECK_THROWS_WITH(expr, msg) REQUIRE_THROWS(expr)

#define REQUIRE_NOTHROW(expr) \\
  do { \\
    try { expr; } catch (const std::exception& e) { \\
      std::stringstream ss; \\
      ss << "Unexpected exception: " << e.what(); \\
      throw std::runtime_error(ss.str()); \\
    } \\
  } while (0)

#define CHECK_NOTHROW(expr) REQUIRE_NOTHROW(expr)

#define REQUIRE_THAT(val, matcher) \\
  do { \\
    if (!(matcher).match(val)) { \\
      std::stringstream ss; \\
      ss << "REQUIRE_THAT failed: value " << (val) << " does not match"; \\
      throw std::runtime_error(ss.str()); \\
    } \\
  } while(0)

#define CHECK_THAT(val, matcher) REQUIRE_THAT(val, matcher)

#define INFO(msg)
#define WARN(msg)
#define FAIL(msg) throw std::runtime_error(std::string("FAIL: ") + (msg))
#define SUCCEED(msg)
#define APPROX(val) (val)
`.trim();
}

// For header files - strip everything preprocessor related
function stripHeaderFile(content) {
  return String(content || "")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (t.startsWith("#include")) return false;
      if (t.startsWith("#pragma")) return false;
      if (t.startsWith("#ifndef")) return false;
      if (t.startsWith("#ifdef")) return false;
      if (t.startsWith("#if ")) return false;
      if (t.startsWith("#if(")) return false;
      if (t.startsWith("#else")) return false;
      if (t.startsWith("#elif")) return false;
      if (t.startsWith("#endif")) return false;
      if (
        t.startsWith("#define") &&
        !t.includes("(") &&
        (t.includes("_H") || t.includes("_HPP"))
      )
        return false;
      return true;
    })
    .join("\n");
}

// For user code and test files - strip ALL includes and preprocessor
function stripPreprocessorLines(content) {
  return String(content || "")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      if (t.startsWith("#include")) return false; // strip ALL includes
      if (t.startsWith("#pragma")) return false;
      if (t.startsWith("#ifndef")) return false;
      if (t.startsWith("#ifdef")) return false;
      if (t.startsWith("#if ")) return false;
      if (t.startsWith("#if(")) return false;
      if (t.startsWith("#else")) return false;
      if (t.startsWith("#elif")) return false;
      if (t.startsWith("#endif")) return false;
      if (
        t.startsWith("#define") &&
        !t.includes("(") &&
        (t.includes("_H") || t.includes("_HPP"))
      )
        return false;
      return true;
    })
    .join("\n");
}

async function loadCppTestFile(exerciseDir, baseName) {
  const patterns = [
    `${baseName}_test.cpp`,
    `test_${baseName}.cpp`,
    `${baseName}-test.cpp`,
    `${baseName}_tests.cpp`,
    `${baseName}.test.cpp`,
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

    // Try both .h and .hpp header extensions
    let headerContent = "";
    for (const ext of [`${baseName}.h`, `${baseName}.hpp`]) {
      try {
        headerContent = await fs.readFile(
          path.join(exerciseDir, ext),
          "utf8"
        );
        break;
      } catch {}
    }

    const testContent = await loadCppTestFile(exerciseDir, baseName);
    if (!testContent) return errorSubmission("C++ test file not found");

    console.log("=== CPP RUNNER ===");
    console.log("Exercise:", exerciseSlug);
    console.log("Runtime:", rt.language, rt.version);

    // Combine everything into single file
    const combinedCpp = `
${minimalCatchJsStyle()}

${stripHeaderFile(headerContent)}

${stripPreprocessorLines(userCode)}

${stripPreprocessorLines(testContent)}

int main() {
  return Catch::runAllTests();
}
`.trim();

    console.log("=== CPP COMBINED (first 500 chars) ===");
    console.log(combinedCpp.slice(0, 500));
    console.log("======================================");

    // Single file only - no separate header
    const payload = {
      language: rt.language,
      version: String(rt.version),
      files: [
        { name: "main.cpp", content: combinedCpp },
      ],
      stdin: stdin || "",
    };

    const r = await http.post("/execute", payload);
    const output = r.data;

    console.log("=== CPP OUTPUT ===");
    console.log("compile stderr:", output.compile?.stderr?.slice(0, 500));
    console.log("run stdout:", output.run?.stdout?.slice(0, 500));
    console.log("run code:", output.run?.code);
    console.log("==================");

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
    console.error("=== CPP RUNNER ERROR ===");
    console.error(e?.message);
    console.error(e?.response?.data);
    return errorSubmission(e?.message || "C++ runner failed");
  }
}