import path from "path";
import fs from "fs/promises";
import { http, getRuntime, findExerciseDir, parseTestLines } from "./common.js";


function unityLite() {
  return `
#include <stdio.h>
#include <string.h>

static int g_failures = 0;
static const char* CURRENT_TEST = "test";

/* Only define if tests didn't define them */
#ifndef UNITY_BEGIN
void UnityBegin(const char* file) { (void)file; g_failures = 0; }
int UnityEnd(void) { return g_failures == 0 ? 0 : 1; }
#define UNITY_BEGIN() UnityBegin(__FILE__)
#define UNITY_END()   UnityEnd()
#endif

#ifndef RUN_TEST
#define RUN_TEST(fn) do { CURRENT_TEST = #fn; fn(); } while (0)
#endif

void UnityAssertEqualString(const char* exp, const char* act, int line) {
  (void)line;
  if (!exp) exp = "";
  if (!act) act = "";

  if (strcmp(exp, act) == 0) {
    printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST);
  } else {
    printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST);
    printf("  Error: Expected \\"%s\\" but got \\"%s\\"\\n", exp, act);
    g_failures++;
  }
}

#ifndef TEST_ASSERT_EQUAL_STRING
#define TEST_ASSERT_EQUAL_STRING(exp, act) UnityAssertEqualString((exp), (act), __LINE__)
#endif
`.trim();
}

function removeQuotedIncludes(code) {
  return String(code || "")
    .split("\n")
    .filter((l) => !l.trim().startsWith('#include "'))
    .join("\n");
}

function cleanHeader(header) {
  return String(header || "")
    .split("\n")
    .filter((l) => {
      const t = l.trim();
      if (!t) return false;
      if (t.startsWith("#")) return false;
      return true;
    })
    .join("\n");
}

export async function runC({ track, category, exerciseSlug, userCode, stdin }) {
  const exerciseDir = await findExerciseDir(track, category, exerciseSlug);
  if (!exerciseDir) return { success: false, error: "Exercise not found" };

  const rt = await getRuntime("c");
  if (!rt?.version) return { success: false, error: "C runtime not found" };

  const base = exerciseSlug.replace(/-/g, "_");

  let header = "";
  let test = "";

  try {
    header = await fs.readFile(path.join(exerciseDir, `${base}.h`), "utf8");
  } catch {}

  try {
    test = await fs.readFile(path.join(exerciseDir, `test_${base}.c`), "utf8");
  } catch {}

  const combined = `
${unityLite()}

${cleanHeader(header)}

${removeQuotedIncludes(userCode)}

${removeQuotedIncludes(test)}
`.trim();

  const payload = {
    language: "c",
    version: String(rt.version),
    files: [{ name: "main.c", content: combined }],
    stdin: stdin || "",
  };

  const r = await http.post("/execute", payload);
  const out = r.data;

  if (out.compile && out.compile.code !== 0) {
    return {
      success: true,
      submission: {
        result: {
          status: "Compilation Error",
          stdout: out.compile.stdout || "",
          stderr: out.compile.stderr || "",
          compileOutput: out.compile.stderr || "",
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

  const stdout = out.run?.stdout || "";
  const tests = parseTestLines(stdout);
  const passed = tests.every((t) => t.passed);

  return {
    success: true,
    submission: {
      result: {
        status: passed ? "Accepted" : "Wrong Answer",
        stdout,
        stderr: out.run?.stderr || "",
        compileOutput: null,
        time: ((out.run?.time || 0) / 1000).toFixed(3),
        memory: out.run?.memory || 0,
      },
      passed,
      testResults: tests,
    },
  };
}
