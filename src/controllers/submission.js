import Submission from "../models/Submission.js";
import { runCodeOnJudge0 } from "../services/judge0Service.js";

export const submitSolution = async (req, res, next) => {
  try {
    const { track, category, exerciseSlug, sourceCode, languageId } = req.body;
    const userId = req.user._id;

    const result = await runCodeOnJudge0(sourceCode, languageId);

    const passed = result.status?.description === "Accepted";

    const submission = await Submission.create({
      user: userId,
      track,
      category,
      exerciseSlug,
      sourceCode,
      languageId,
      result: {
        status: result.status.description,
        stdout: result.stdout,
        stderr: result.stderr,
        compileOutput: result.compile_output,
        time: result.time,
        memory: result.memory
      },
      passed
    });

    res.status(200).json({
      message: passed ? "Submission accepted" : "Submission failed",
      submission
    });
  } catch (err) {
    next(err);
  }
};
