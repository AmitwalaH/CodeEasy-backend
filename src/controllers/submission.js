import { runJavascript } from "./runner/runJavascript.js";
import { runC } from "./runner/runC.js";
import { runCpp } from "./runner/runCpp.js";
import { runPython } from "./runner/runPython.js";
import { runPhp } from "./runner/runPhp.js";
// import { runGo } from "./runner/runGo.js";
// import { runCsharp } from "./runner/runCsharp.js";
import { runR } from "./runner/runR.js";
import { runRuby } from "./runner/runRuby.js";

// Judge0-like ID -> language mapping
const languageMap = {
  63: "javascript",  // JavaScript (Node.js)
  50: "c",           // C (GCC)
  54: "cpp",         // C++ (G++)
  71: "python",      // Python 3
  68: "php",         // PHP
  60: "go",          // Go
  51: "csharp",      // C#
  80: "r",           // R
  72: "ruby",        // Ruby
};

// Always return same shape so frontend never crashes
function errorSubmission(message) {
  return {
    success: true,
    submission: {
      result: {
        status: "Error",
        stdout: "",
        stderr: String(message || "Error"),
        compileOutput: null,
        time: "0.000",
        memory: 0,
      },
      passed: false,
      testResults: [
        {
          input: "Execution",
          expectedOutput: "Success",
          actualOutput: "Error",
          passed: false,
        },
      ],
    },
  };
}

export const submitCode = async (req, res) => {
  try {
    const body = req.body || {};

    const track = body.track;
    const category = body.category;
    const exerciseSlug = body.exerciseSlug;

    const userCode = String(body.sourceCode ?? body.source_code ?? "").trim();
    const langId = Number(body.languageId ?? body.language_id ?? 63);
    const stdin = body.stdin || "";

    console.log("=== SUBMISSION REQUEST ===");
    console.log("Track:", track);
    console.log("Category:", category);
    console.log("Exercise:", exerciseSlug);
    console.log("Language ID:", langId);
    console.log("Code length:", userCode.length);

    if (!userCode) {
      return res.status(400).json(errorSubmission("Source code is missing"));
    }

    const lang = languageMap[langId];
    if (!lang) {
      return res
        .status(400)
        .json(
          errorSubmission(
            `Language ID ${langId} not supported. Supported IDs: ${Object.keys(languageMap).join(", ")}`,
          ),
        );
    }

    console.log("Language:", lang);

    let result;

    // Route to appropriate language runner
    switch (lang) {
      case "javascript":
        result = await runJavascript({
          track,
          category,
          exerciseSlug,
          userCode,
          stdin,
        });
        break;

      case "c":
        result = await runC({
          track,
          category,
          exerciseSlug,
          userCode,
          stdin,
        });
        break;

      case "cpp":
        result = await runCpp({
          track,
          category,
          exerciseSlug,
          userCode,
          stdin,
        });
        break;

      case "python":
        result = await runPython({
          track,
          category,
          exerciseSlug,
          userCode,
          stdin,
        });
        break;

      case "php":
        result = await runPhp({
          track,
          category,
          exerciseSlug,
          userCode,
          stdin,
        });
        break;

      case "go":
        result = await runGo({
          track,
          category,
          exerciseSlug,
          userCode,
          stdin,
        });
        break;

      case "csharp":
        result = await runCsharp({
          track,
          category,
          exerciseSlug,
          userCode,
          stdin,
        });
        break;

      case "r":
        result = await runR({
          track,
          category,
          exerciseSlug,
          userCode,
          stdin,
        });
        break;

      case "ruby":
        result = await runRuby({
          track,
          category,
          exerciseSlug,
          userCode,
          stdin,
        });
        break;

      default:
        result = errorSubmission(`Language ${lang} not implemented`);
    }

    // Ensure frontend never gets undefined
    if (!result?.success || !result?.submission) {
      console.error("Invalid runner response:", result);
      return res.json(errorSubmission("Runner returned invalid response"));
    }

    console.log("=== SUBMISSION COMPLETE ===");
    console.log("Status:", result.submission.result.status);
    console.log("Passed:", result.submission.passed);

    return res.json(result);
  } catch (e) {
    console.error("=== SUBMISSION ERROR ===");
    console.error("Error:", e);
    return res.status(500).json(errorSubmission(e?.message || "Server error"));
  }
};