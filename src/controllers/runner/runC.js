import path from "path";
import fs from "fs/promises";
import { http, getRuntime, findExerciseDir, parseTestLines } from "./common.js";


function unityLite() {
  return `
#include <stdio.h>
#include <string.h>
#include <stdint.h>
#include <stdlib.h>
#include <math.h>

static int g_failures = 0;
static const char* CURRENT_TEST = "test";

#ifndef UNITY_BEGIN
void UnityBegin(const char* file) { (void)file; g_failures = 0; }
int UnityEnd(void) { return g_failures == 0 ? 0 : 1; }
#define UNITY_BEGIN() UnityBegin(__FILE__)
#define UNITY_END()   UnityEnd()
#endif

#ifndef RUN_TEST
#define RUN_TEST(fn) do { CURRENT_TEST = #fn; fn(); } while (0)
#endif

#ifndef TEST_IGNORE
#define TEST_IGNORE() do { \\
  printf("TEST: %s - SKIP\\n", CURRENT_TEST); \\
  return; \\
} while(0)
#endif

#ifndef TEST_FAIL
#define TEST_FAIL() do { \\
  printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); \\
  printf("  Error: TEST_FAIL called\\n"); \\
  g_failures++; \\
} while(0)
#endif

#ifndef TEST_FAIL_MESSAGE
#define TEST_FAIL_MESSAGE(msg) do { \\
  printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); \\
  printf("  Error: %s\\n", msg); \\
  g_failures++; \\
} while(0)
#endif

/* ── String ── */
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

/* ── Bool / True / False ── */
#ifndef TEST_ASSERT_TRUE
#define TEST_ASSERT_TRUE(cond) do { \\
  if (cond) { printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST); } \\
  else { printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); printf("  Error: Expected true\\n"); g_failures++; } \\
} while(0)
#endif

#ifndef TEST_ASSERT_FALSE
#define TEST_ASSERT_FALSE(cond) do { \\
  if (!(cond)) { printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST); } \\
  else { printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); printf("  Error: Expected false\\n"); g_failures++; } \\
} while(0)
#endif

/* ── NULL ── */
#ifndef TEST_ASSERT_NULL
#define TEST_ASSERT_NULL(ptr) do { \\
  if ((ptr) == NULL) { printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST); } \\
  else { printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); printf("  Error: Expected NULL\\n"); g_failures++; } \\
} while(0)
#endif

#ifndef TEST_ASSERT_NOT_NULL
#define TEST_ASSERT_NOT_NULL(ptr) do { \\
  if ((ptr) != NULL) { printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST); } \\
  else { printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); printf("  Error: Expected not NULL\\n"); g_failures++; } \\
} while(0)
#endif

/* ── Generic int helper ── */
#define _ASSERT_INT_EQ(exp, act, fmt) do { \\
  if ((exp) == (act)) { printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST); } \\
  else { printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); printf("  Error: Expected " fmt " but got " fmt "\\n", (exp), (act)); g_failures++; } \\
} while(0)

/* ── Signed integers ── */
#ifndef TEST_ASSERT_EQUAL_INT
#define TEST_ASSERT_EQUAL_INT(exp, act)   _ASSERT_INT_EQ((int)(exp),    (int)(act),    "%d")
#endif
#ifndef TEST_ASSERT_EQUAL
#define TEST_ASSERT_EQUAL(exp, act)       TEST_ASSERT_EQUAL_INT(exp, act)
#endif
#ifndef TEST_ASSERT_EQUAL_INT8
#define TEST_ASSERT_EQUAL_INT8(exp, act)  _ASSERT_INT_EQ((int8_t)(exp),  (int8_t)(act),  "%d")
#endif
#ifndef TEST_ASSERT_EQUAL_INT16
#define TEST_ASSERT_EQUAL_INT16(exp, act) _ASSERT_INT_EQ((int16_t)(exp), (int16_t)(act), "%d")
#endif
#ifndef TEST_ASSERT_EQUAL_INT32
#define TEST_ASSERT_EQUAL_INT32(exp, act) _ASSERT_INT_EQ((int32_t)(exp), (int32_t)(act), "%d")
#endif
#ifndef TEST_ASSERT_EQUAL_INT64
#define TEST_ASSERT_EQUAL_INT64(exp, act) _ASSERT_INT_EQ((int64_t)(exp), (int64_t)(act), "%lld")
#endif

/* ── Unsigned integers ── */
#ifndef TEST_ASSERT_EQUAL_UINT
#define TEST_ASSERT_EQUAL_UINT(exp, act)   _ASSERT_INT_EQ((unsigned)(exp),  (unsigned)(act),  "%u")
#endif
#ifndef TEST_ASSERT_EQUAL_UINT8
#define TEST_ASSERT_EQUAL_UINT8(exp, act)  _ASSERT_INT_EQ((uint8_t)(exp),   (uint8_t)(act),   "%u")
#endif
#ifndef TEST_ASSERT_EQUAL_UINT16
#define TEST_ASSERT_EQUAL_UINT16(exp, act) _ASSERT_INT_EQ((uint16_t)(exp),  (uint16_t)(act),  "%u")
#endif
#ifndef TEST_ASSERT_EQUAL_UINT32
#define TEST_ASSERT_EQUAL_UINT32(exp, act) _ASSERT_INT_EQ((uint32_t)(exp),  (uint32_t)(act),  "%u")
#endif
#ifndef TEST_ASSERT_EQUAL_UINT64
#define TEST_ASSERT_EQUAL_UINT64(exp, act) _ASSERT_INT_EQ((uint64_t)(exp),  (uint64_t)(act),  "%llu")
#endif

/* ── size_t ── */
#ifndef TEST_ASSERT_EQUAL_SIZE_T
#define TEST_ASSERT_EQUAL_SIZE_T(exp, act) _ASSERT_INT_EQ((size_t)(exp), (size_t)(act), "%zu")
#endif

/* ── Float / Double ── */
#ifndef TEST_ASSERT_EQUAL_FLOAT
#define TEST_ASSERT_EQUAL_FLOAT(exp, act) do { \\
  float _d = fabsf((float)(exp) - (float)(act)); \\
  if (_d < 0.0001f) { printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST); } \\
  else { printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); printf("  Error: Float mismatch\\n"); g_failures++; } \\
} while(0)
#endif

#ifndef TEST_ASSERT_EQUAL_DOUBLE
#define TEST_ASSERT_EQUAL_DOUBLE(exp, act) do { \\
  double _d = fabs((double)(exp) - (double)(act)); \\
  if (_d < 0.00001) { printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST); } \\
  else { printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); printf("  Error: Double mismatch\\n"); g_failures++; } \\
} while(0)
#endif

#ifndef TEST_ASSERT_FLOAT_WITHIN
#define TEST_ASSERT_FLOAT_WITHIN(delta, exp, act) do { \\
  float _d = fabsf((float)(exp) - (float)(act)); \\
  if (_d <= (float)(delta)) { printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST); } \\
  else { printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); printf("  Error: Float not within delta\\n"); g_failures++; } \\
} while(0)
#endif

#ifndef TEST_ASSERT_DOUBLE_WITHIN
#define TEST_ASSERT_DOUBLE_WITHIN(delta, exp, act) do { \\
  double _d = fabs((double)(exp) - (double)(act)); \\
  if (_d <= (double)(delta)) { printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST); } \\
  else { printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); printf("  Error: Double not within delta\\n"); g_failures++; } \\
} while(0)
#endif

/* ── Generic array helper ── */
#define _ASSERT_ARRAY_EQ(exp, act, len, fmt, type) do { \\
  int _pass = 1; \\
  for (int _i = 0; _i < (int)(len); _i++) { \\
    if ((type)(exp)[_i] != (type)(act)[_i]) { _pass = 0; break; } \\
  } \\
  if (_pass) { printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST); } \\
  else { printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); printf("  Error: Arrays differ\\n"); g_failures++; } \\
} while(0)

/* ── Array assertions ── */
#ifndef TEST_ASSERT_EQUAL_INT_ARRAY
#define TEST_ASSERT_EQUAL_INT_ARRAY(exp, act, len)    _ASSERT_ARRAY_EQ(exp, act, len, "%d",   int)
#endif
#ifndef TEST_ASSERT_EQUAL_INT8_ARRAY
#define TEST_ASSERT_EQUAL_INT8_ARRAY(exp, act, len)   _ASSERT_ARRAY_EQ(exp, act, len, "%d",   int8_t)
#endif
#ifndef TEST_ASSERT_EQUAL_INT16_ARRAY
#define TEST_ASSERT_EQUAL_INT16_ARRAY(exp, act, len)  _ASSERT_ARRAY_EQ(exp, act, len, "%d",   int16_t)
#endif
#ifndef TEST_ASSERT_EQUAL_INT32_ARRAY
#define TEST_ASSERT_EQUAL_INT32_ARRAY(exp, act, len)  _ASSERT_ARRAY_EQ(exp, act, len, "%d",   int32_t)
#endif
#ifndef TEST_ASSERT_EQUAL_INT64_ARRAY
#define TEST_ASSERT_EQUAL_INT64_ARRAY(exp, act, len)  _ASSERT_ARRAY_EQ(exp, act, len, "%lld", int64_t)
#endif
#ifndef TEST_ASSERT_EQUAL_UINT8_ARRAY
#define TEST_ASSERT_EQUAL_UINT8_ARRAY(exp, act, len)  _ASSERT_ARRAY_EQ(exp, act, len, "%u",   uint8_t)
#endif
#ifndef TEST_ASSERT_EQUAL_UINT16_ARRAY
#define TEST_ASSERT_EQUAL_UINT16_ARRAY(exp, act, len) _ASSERT_ARRAY_EQ(exp, act, len, "%u",   uint16_t)
#endif
#ifndef TEST_ASSERT_EQUAL_UINT32_ARRAY
#define TEST_ASSERT_EQUAL_UINT32_ARRAY(exp, act, len) _ASSERT_ARRAY_EQ(exp, act, len, "%u",   uint32_t)
#endif
#ifndef TEST_ASSERT_EQUAL_UINT64_ARRAY
#define TEST_ASSERT_EQUAL_UINT64_ARRAY(exp, act, len) _ASSERT_ARRAY_EQ(exp, act, len, "%llu", uint64_t)
#endif
#ifndef TEST_ASSERT_EQUAL_STRING_ARRAY
#define TEST_ASSERT_EQUAL_STRING_ARRAY(exp, act, len) do { \\
  int _pass = 1; \\
  for (int _i = 0; _i < (int)(len); _i++) { \\
    if (strcmp((exp)[_i], (act)[_i]) != 0) { _pass = 0; break; } \\
  } \\
  if (_pass) { printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST); } \\
  else { printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); printf("  Error: String arrays differ\\n"); g_failures++; } \\
} while(0)
#endif

/* ── Greater / Less than ── */
#ifndef TEST_ASSERT_GREATER_THAN
#define TEST_ASSERT_GREATER_THAN(threshold, actual) do { \\
  if ((actual) > (threshold)) { printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST); } \\
  else { printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); printf("  Error: Expected greater than %d\\n", (int)(threshold)); g_failures++; } \\
} while(0)
#endif

#ifndef TEST_ASSERT_LESS_THAN
#define TEST_ASSERT_LESS_THAN(threshold, actual) do { \\
  if ((actual) < (threshold)) { printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST); } \\
  else { printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); printf("  Error: Expected less than %d\\n", (int)(threshold)); g_failures++; } \\
} while(0)
#endif

#ifndef TEST_ASSERT_GREATER_OR_EQUAL
#define TEST_ASSERT_GREATER_OR_EQUAL(threshold, actual) do { \\
  if ((actual) >= (threshold)) { printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST); } \\
  else { printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); printf("  Error: Expected >= threshold\\n"); g_failures++; } \\
} while(0)
#endif

#ifndef TEST_ASSERT_LESS_OR_EQUAL
#define TEST_ASSERT_LESS_OR_EQUAL(threshold, actual) do { \\
  if ((actual) <= (threshold)) { printf("TEST: %s - PASS \\xE2\\x9C\\x93\\n", CURRENT_TEST); } \\
  else { printf("TEST: %s - FAIL \\xE2\\x9C\\x97\\n", CURRENT_TEST); printf("  Error: Expected <= threshold\\n"); g_failures++; } \\
} while(0)
#endif

/* ── Bits ── */
#ifndef TEST_ASSERT_BITS
#define TEST_ASSERT_BITS(mask, exp, act) TEST_ASSERT_EQUAL_INT((exp) & (mask), (act) & (mask))
#endif
#ifndef TEST_ASSERT_BIT_HIGH
#define TEST_ASSERT_BIT_HIGH(bit, actual) TEST_ASSERT_TRUE((actual) & (1 << (bit)))
#endif
#ifndef TEST_ASSERT_BIT_LOW
#define TEST_ASSERT_BIT_LOW(bit, actual) TEST_ASSERT_FALSE((actual) & (1 << (bit)))
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
      if (t.startsWith("#ifndef") && t.includes("_H")) return false;
      if (t.startsWith("#define") && t.includes("_H") && !t.includes("(")) return false;
      if (t === "#endif") return false;
      if (t.startsWith("#pragma once")) return false;
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
  const passed = tests.length > 0 && tests.every((t) => t.passed);

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