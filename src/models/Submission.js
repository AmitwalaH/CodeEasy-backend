// src/models/Submission.js
import mongoose from "mongoose";

const SubmissionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    track: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    exerciseSlug: {
      type: String,
      required: true,
    },
    sourceCode: {
      type: String,
      required: true,
    },
    languageId: {
      type: Number,
      required: true,
    },
    result: {
      status: {
        type: String,
      },
      stdout: {
        type: String,
      },
      stderr: {
        type: String,
      },
      compileOutput: {
        type: String,
      },
      time: {
        type: Number,
      },
      memory: {
        type: Number,
      },
    },
    passed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const Submission = mongoose.model("Submission", SubmissionSchema);
export default Submission;
