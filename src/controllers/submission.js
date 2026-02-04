import { runJavascript } from "./runner/runJavascript.js";
import { runC } from "./runner/runC.js";
import { runCpp } from "./runner/runCpp.js";
import { runPython } from "./runner/runPython.js";

// Judge0-like ID -> language
const languageMap = {
  63: "javascript",
  50: "c",
  54: "cpp",
  71: "python",
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

    if (!userCode) {
      return res.status(400).json(errorSubmission("Source code is missing"));
    }

    const lang = languageMap[langId];
    if (!lang) {
      return res
        .status(400)
        .json(
          errorSubmission(
            `Language ID ${langId} not supported. Supported: ${Object.keys(languageMap).join(", ")}`,
          ),
        );
    }

    let result;

    if (lang === "javascript") {
      result = await runJavascript({
        track,
        category,
        exerciseSlug,
        userCode,
        stdin,
      });
    } else if (lang === "c") {
      result = await runC({ track, category, exerciseSlug, userCode, stdin });
    } else if (lang === "cpp") {
      result = await runCpp({ track, category, exerciseSlug, userCode, stdin });
    } else if (lang === "python") {
      result = await runPython({
        track,
        category,
        exerciseSlug,
        userCode,
        stdin,
      });
    } else {
      result = errorSubmission(`Language ${lang} not implemented`);
    }

    // Ensure frontend never gets undefined
    if (!result?.success || !result?.submission) {
      return res.json(errorSubmission("Runner returned invalid response"));
    }

    return res.json(result);
  } catch (e) {
    return res.status(500).json(errorSubmission(e?.message || "Server error"));
  }
};
