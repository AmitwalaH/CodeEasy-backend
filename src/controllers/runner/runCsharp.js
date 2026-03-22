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

async function findCsharpFiles(exerciseDir, slug) {
  const meta = await readMetaConfig(exerciseDir);
  const pascal = slug
    .split("-")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join("");

  let solution = `${pascal}.cs`;
  let test = `${pascal}Test.cs`;

  if (meta?.files?.solution?.length) {
    solution = applySlugPattern(slug, meta.files.solution[0]);
  }
  if (meta?.files?.test?.length) {
    test = applySlugPattern(slug, meta.files.test[0]);
  }

  const candidates = [
    test,
    `${pascal}Tests.cs`,
    `${pascal}Test.cs`,
  ];

  for (const t of candidates) {
    const p = path.join(exerciseDir, t);
    if (fsSync.existsSync(p)) {
      return { solution, test: t, testPath: p };
    }
  }

  return { solution, test, testPath: path.join(exerciseDir, test) };
}

function buildCsharpRunner(userCode, testContent, exerciseSlug) {
  const cleanUserCode = String(userCode || "")
    .replace(/^\s*using\s+Xunit\s*;/gm, "")
    .replace(/^\s*using\s+NUnit[^;]*;/gm, "")
    .replace(/^\s*\[Fact\]/gm, "")
    .replace(/^\s*\[Test\]/gm, "")
    .replace(/^\s*\[Theory\]/gm, "")
    .trim();

  let cleanTest = String(testContent || "")
    .replace(/^\s*using\s+Xunit\s*;/gm, "")
    .replace(/^\s*using\s+NUnit[^;]*;/gm, "")
    .trim();

  // Extract test methods
  const testMethodRe = /\[(?:Fact|Test)\]\s*(?:\/\/[^\n]*)?\s*public\s+void\s+(\w+)\s*\(\s*\)\s*\{([\s\S]*?)(?=\n\s{4}\[(?:Fact|Test)\]|\n\s{4}public|\n\s*\})/g;
  const testMethods = [];
  let m;
  while ((m = testMethodRe.exec(cleanTest)) !== null) {
    testMethods.push({ name: m[1], body: m[2] });
  }

  console.log("C# test methods found:", testMethods.length);

  const lines = [];
  lines.push(`using System;`);
  lines.push(`using System.Collections.Generic;`);
  lines.push(`using System.Linq;`);
  lines.push(``);

  // Add solution code
  lines.push(cleanUserCode);
  lines.push(``);

  // Add Assert class
  lines.push(`public static class Assert {`);
  lines.push(`  public static void Equal<T>(T expected, T actual) {`);
  lines.push(`    if (!expected.Equals(actual))`);
  lines.push(`      throw new Exception($"Expected {expected} but got {actual}");`);
  lines.push(`  }`);
  lines.push(`  public static void Equal(string expected, string actual) {`);
  lines.push(`    if (expected != actual)`);
  lines.push(`      throw new Exception($"Expected '{expected}' but got '{actual}'");`);
  lines.push(`  }`);
  lines.push(`  public static void True(bool condition, string msg = "") {`);
  lines.push(`    if (!condition) throw new Exception(msg != "" ? msg : "Expected true");`);
  lines.push(`  }`);
  lines.push(`  public static void False(bool condition, string msg = "") {`);
  lines.push(`    if (condition) throw new Exception(msg != "" ? msg : "Expected false");`);
  lines.push(`  }`);
  lines.push(`  public static void Null(object obj) {`);
  lines.push(`    if (obj != null) throw new Exception("Expected null");`);
  lines.push(`  }`);
  lines.push(`  public static void NotNull(object obj) {`);
  lines.push(`    if (obj == null) throw new Exception("Expected not null");`);
  lines.push(`  }`);
  lines.push(`  public static void Throws<T>(Action action) where T : Exception {`);
  lines.push(`    try { action(); throw new Exception($"Expected {typeof(T).Name} but none thrown"); }`);
  lines.push(`    catch (T) { }`);
  lines.push(`  }`);
  lines.push(`  public static void Contains<T>(T item, IEnumerable<T> col) {`);
  lines.push(`    if (!col.Contains(item)) throw new Exception($"Expected collection to contain {item}");`);
  lines.push(`  }`);
  lines.push(`  public static void Empty<T>(IEnumerable<T> col) {`);
  lines.push(`    if (col.Any()) throw new Exception("Expected empty collection");`);
  lines.push(`  }`);
  lines.push(`}`);
  lines.push(``);

  if (testMethods.length > 0) {
    lines.push(`class Program {`);
    lines.push(`  static void Main() {`);
    lines.push(`    int failures = 0;`);

    for (const method of testMethods) {
      const testName = method.name
        .replace(/([A-Z])/g, " $1")
        .trim()
        .toLowerCase();

      let body = method.body;
      // Replace Assert.Equal with our Assert
      body = body.replace(/Assert\.Equal\s*\(/g, "Assert.Equal(");
      body = body.replace(/Assert\.True\s*\(/g, "Assert.True(");
      body = body.replace(/Assert\.False\s*\(/g, "Assert.False(");
      body = body.replace(/Assert\.Null\s*\(/g, "Assert.Null(");
      body = body.replace(/Assert\.NotNull\s*\(/g, "Assert.NotNull(");
      body = body.replace(/Assert\.Throws\s*</g, "Assert.Throws<");

      lines.push(`    try {`);
      lines.push(body);
      lines.push(`      Console.WriteLine("TEST: ${testName} - PASS ok");`);
      lines.push(`    } catch (Exception e) {`);
      lines.push(`      Console.WriteLine("TEST: ${testName} - FAIL xx");`);
      lines.push(`      Console.WriteLine("  Error: " + e.Message);`);
      lines.push(`      failures++;`);
      lines.push(`    }`);
    }

    lines.push(`    Environment.Exit(failures > 0 ? 1 : 0);`);
    lines.push(`  }`);
    lines.push(`}`);
  } else {
    lines.push(`class Program {`);
    lines.push(`  static void Main() {`);
    lines.push(`    Console.WriteLine("No tests found");`);
    lines.push(`  }`);
    lines.push(`}`);
  }

  return lines.join("\n");
}

export async function runCsharp({
  track,
  category,
  exerciseSlug,
  userCode,
  stdin,
}) {
  try {
    const exerciseDir = await findExerciseDir(track, category, exerciseSlug);
    if (!exerciseDir) return errorSubmission("Exercise not found");

    const rt = await getRuntime("csharp");
    if (!rt?.version) return errorSubmission("C# runtime not found");

    const { solution, test, testPath } = await findCsharpFiles(
      exerciseDir,
      exerciseSlug
    );

    let testContent = "";
    if (fsSync.existsSync(testPath)) {
      testContent = await fs.readFile(testPath, "utf8");
    }

    const mainCs = buildCsharpRunner(userCode, testContent, exerciseSlug);

    console.log("=== CSHARP RUNNER ===");
    console.log("Exercise:", exerciseSlug);
    console.log("Runtime:", rt.version);
    console.log("=== CS MAIN (first 500 chars) ===");
    console.log(mainCs.slice(0, 500));

    const files = [
      { name: "main.cs", content: mainCs },
    ];

    const payload = {
      language: "csharp",
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

    console.log("=== CSHARP OUTPUT ===");
    console.log("compile:", compileStderr?.slice(0, 300));
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
    console.error("=== CSHARP RUNNER ERROR ===", e?.message);
    return errorSubmission(e?.message || "C# runner failed");
  }
}