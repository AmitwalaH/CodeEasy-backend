import path from "path";
import fs from "fs/promises";
import { http, getRuntime, findExerciseDir, parseTestLines } from "./common.js";

function unityMini() {
  return `#include <stdio.h>
#include <string.h>

static const char* CURRENT_TEST = "test";

void UnityAssertEqualString(const char* exp, const char* act) {
  if (strcmp(exp, act) == 0) {
    printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST);
  } else {
    printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST);
    printf("  Error: Expected \\"%s\\" but got \\"%s\\"\\n", exp, act);
  }
}

#define TEST_ASSERT_EQUAL_STRING(expected, actual) UnityAssertEqualString(expected, actual)
#define RUN_TEST(fn) do { CURRENT_TEST = #fn; fn(); } while(0)
`;
}

function removeQuoteIncludes(code) {
  return String(code || "")
    .split("\n")
    .filter((line) => !line.trim().match(/^#include\s+"[^"]+"/))
    .join("\n");
}

function cleanHeader(headerContent) {
  return String(headerContent || "")
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (t.startsWith("#include")) return false;
      if (t.startsWith("#ifndef")) return false;
      if (t.startsWith("#define")) return false;
      if (t.startsWith("#endif")) return false;
      return true;
    })
    .join("\n");
}

export async function runC({ track, category, exerciseSlug, userCode, stdin }) {
  const exerciseDir = await findExerciseDir(track, category, exerciseSlug);
  if (!exerciseDir) return { success: false, error: `Exercise not found` };

  const rt = await getRuntime("c");
  if (!rt?.version)
    return { success: false, error: "C runtime not found in Piston" };

  const base = exerciseSlug.replace(/-/g, "_");
  const headerFile = path.join(exerciseDir, `${base}.h`);
  const testFile = path.join(exerciseDir, `test_${base}.c`);

  let headerContent = "";
  let testContent = "";

  try {
    headerContent = await fs.readFile(headerFile, "utf8");
  } catch {}
  try {
    testContent = await fs.readFile(testFile, "utf8");
  } catch {}

  const combined = `
${unityMini()}

${cleanHeader(headerContent)}

${removeQuoteIncludes(userCode)}

${removeQuoteIncludes(testContent)}
`.trim();

  const payload = {
    language: "c",
    version: String(rt.version),
    files: [{ name: "main.c", content: combined }],
    stdin: stdin || "",
  };

  const r = await http.post("/execute", payload);
  const output = r.data;

  // compilation check
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
