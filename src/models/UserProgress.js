import mongoose from "mongoose";

const UserProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    trackSlug: { type: String, required: true },
    exerciseSlug: { type: String, required: true },
    category: { type: String, default: "practice" },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
    },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

UserProgressSchema.index(
  { user: 1, trackSlug: 1, exerciseSlug: 1 },
  { unique: true }
);

export default mongoose.model("UserProgress", UserProgressSchema);
