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

async function findRubyFiles(exerciseDir, slug) {
  const meta = await readMetaConfig(exerciseDir);
  const snake = slug.replace(/-/g, "_");
  let solution = `${snake}.rb`;
  let test = `${snake}_test.rb`;

  if (meta?.files?.solution?.length) {
    solution = applySlugPattern(slug, meta.files.solution[0]);
  }
  if (meta?.files?.test?.length) {
    test = applySlugPattern(slug, meta.files.test[0]);
  }

  return { solution, test, testPath: path.join(exerciseDir, test) };
}

function buildRubyRunner(userCode, testContent, exerciseSlug) {
  const cleanUserCode = String(userCode || "")
    .replace(/^\s*require\s+.*$/gm, "")
    .replace(/^\s*require_relative\s+.*$/gm, "")
    .trim();

  let cleanTest = String(testContent || "")
    .replace(/^\s*require\s+.*$/gm, "")
    .replace(/^\s*require_relative\s+.*$/gm, "")
    .replace(/^\s*#\s*skip.*$/gm, "")
    .replace(/^\s*skip\b.*$/gm, "")
    .replace(/\\\#/g, "#")
    .replace(/assert_equal\s*(.*?),\s*(.*?),\s*".*?"\s*$/gm, "assert_equal $1, $2")
    .replace(/^class\s+\w+\s*(<\s*[\w:]+)?\s*$/gm, "")
    .replace(/def\s+setup\b[\s\S]*?^  end$/gm, "")
    .replace(/def\s+teardown\b[\s\S]*?^  end$/gm, "")
    .trim();

  // Remove last standalone 'end' (class closing)
  const testLines = cleanTest.split("\n");
  for (let i = testLines.length - 1; i >= 0; i--) {
    if (testLines[i].trim() === "end") {
      testLines.splice(i, 1);
      break;
    }
  }
  cleanTest = testLines.join("\n");

  // Replace def test_xxx with run_test("test xxx") do
  cleanTest = cleanTest.replace(
    /^(\s*)def\s+(test_\w+)\s*$/gm,
    (_, indent, name) => {
      const testName = name.replace(/_/g, " ");
      return `${indent}run_test("${testName}") do`;
    }
  );

  const lines = [];
  lines.push(`$failures = 0`);
  lines.push(`$current_test = ""`);
  lines.push(``);
  lines.push(`class SkipTest < StandardError; end`);
  lines.push(``);
  lines.push(`def run_test(name)`);
  lines.push(`  $current_test = name`);
  lines.push(`  begin`);
  lines.push(`    yield`);
  lines.push(`    puts "TEST: " + name + " - PASS ok"`);
  lines.push(`  rescue SkipTest`);
  lines.push(`    puts "TEST: " + name + " - SKIP"`);
  lines.push(`  rescue => e`);
  lines.push(`    puts "TEST: " + name + " - FAIL xx"`);
  lines.push(`    puts "  Error: " + e.message`);
  lines.push(`    $failures += 1`);
  lines.push(`  end`);
  lines.push(`end`);
  lines.push(``);
  lines.push(`def assert_equal(expected, actual, msg = nil)`);
  lines.push(`  if expected.is_a?(Float) || actual.is_a?(Float)`);
  lines.push(`    unless (expected.to_f - actual.to_f).abs < 1e-9`);
  lines.push(`      raise "Expected " + expected.inspect + " but got " + actual.inspect`);
  lines.push(`    end`);
  lines.push(`  else`);
  lines.push(`    unless expected == actual`);
  lines.push(`      raise "Expected " + expected.inspect + " but got " + actual.inspect`);
  lines.push(`    end`);
  lines.push(`  end`);
  lines.push(`end`);
  lines.push(``);
  lines.push(`def assert(value, msg = "Expected truthy value")`);
  lines.push(`  raise msg.to_s unless value`);
  lines.push(`end`);
  lines.push(``);
  lines.push(`def refute(value, msg = "Expected falsy value")`);
  lines.push(`  raise msg.to_s if value`);
  lines.push(`end`);
  lines.push(``);
  lines.push(`def assert_nil(value, msg = nil)`);
  lines.push(`  raise "Expected nil but got " + value.inspect unless value.nil?`);
  lines.push(`end`);
  lines.push(``);
  lines.push(`def refute_nil(value, msg = nil)`);
  lines.push(`  raise "Expected not nil" if value.nil?`);
  lines.push(`end`);
  lines.push(``);
  lines.push(`def assert_raises(*exceptions)`);
  lines.push(`  raised = false`);
  lines.push(`  begin`);
  lines.push(`    yield`);
  lines.push(`  rescue *exceptions`);
  lines.push(`    raised = true`);
  lines.push(`  rescue => e`);
  lines.push(`    raise "Unexpected: " + e.class.to_s + ": " + e.message`);
  lines.push(`  end`);
  lines.push(`  raise "Expected exception but none raised" unless raised`);
  lines.push(`end`);
  lines.push(``);
  lines.push(`def assert_includes(col, item, msg = nil)`);
  lines.push(`  raise "Expected to include " + item.inspect unless col.include?(item)`);
  lines.push(`end`);
  lines.push(``);
  lines.push(`def assert_match(pattern, string, msg = nil)`);
  lines.push(`  raise "Expected match" unless string.match?(pattern)`);
  lines.push(`end`);
  lines.push(``);
  lines.push(`def assert_in_delta(expected, actual, delta = 0.001, msg = nil)`);
  lines.push(`  raise "Expected " + expected.to_s + " within " + delta.to_s + " of " + actual.to_s unless (expected - actual).abs <= delta`);
  lines.push(`end`);
  lines.push(``);
  lines.push(`def skip(msg = "skipped")`);
  lines.push(`  raise SkipTest.new(msg.to_s)`);
  lines.push(`end`);
  lines.push(``);
  lines.push(`def flunk(msg = "flunked")`);
  lines.push(`  raise msg.to_s`);
  lines.push(`end`);
  lines.push(``);
  lines.push(`# User solution`);
  lines.push(cleanUserCode);
  lines.push(``);
  lines.push(`# Tests`);
  lines.push(cleanTest);
  lines.push(``);
  lines.push(`exit($failures > 0 ? 1 : 0)`);

  return lines.join("\n");
}

export async function runRuby({
  track,
  category,
  exerciseSlug,
  userCode,
  stdin,
}) {
  try {
    const exerciseDir = await findExerciseDir(track, category, exerciseSlug);
    if (!exerciseDir) return errorSubmission("Exercise not found");

    const rt = await getRuntime("ruby");
    if (!rt?.version) return errorSubmission("Ruby runtime not found");

    const { solution, test, testPath } = await findRubyFiles(
      exerciseDir,
      exerciseSlug
    );

    let testContent = "";
    if (fsSync.existsSync(testPath)) {
      testContent = await fs.readFile(testPath, "utf8");
    }

    const mainRb = buildRubyRunner(userCode, testContent, exerciseSlug);

    console.log("=== RUBY RUNNER ===");
    console.log("Exercise:", exerciseSlug);
    console.log("Runtime:", rt.version);
    console.log("=== RUBY MAIN (first 500 chars) ===");
    console.log(mainRb.slice(0, 500));

    const files = [
      { name: "main.rb", content: mainRb },
    ];

    const payload = {
      language: "ruby",
      version: String(rt.version),
      files,
      stdin: stdin || "",
    };

    const r = await http.post("/execute", payload);
    const out = r.data;

    const stdout = out.run?.stdout || "";
    const stderr = out.run?.stderr || "";
    const exitCode = out.run?.code ?? 0;

    console.log("=== RUBY OUTPUT ===");
    console.log("stdout:", stdout?.slice(0, 500));
    console.log("stderr:", stderr?.slice(0, 300));
    console.log("code:", exitCode);

    if (!stdout && stderr) {
      return {
        success: true,
        submission: {
          result: {
            status: "Compilation Error",
            stdout: "",
            stderr: stderr,
            compileOutput: stderr,
            time: "0",
            memory: 0,
          },
          passed: false,
          testResults: [{
            input: "Error",
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
          compileOutput: null,
          time: ((out.run?.time || 0) / 1000).toFixed(3),
          memory: out.run?.memory || 0,
        },
        passed: allPassed,
        testResults,
      },
    };
  } catch (e) {
    console.error("=== RUBY RUNNER ERROR ===", e?.message);
    return errorSubmission(e?.message || "Ruby runner failed");
  }
}