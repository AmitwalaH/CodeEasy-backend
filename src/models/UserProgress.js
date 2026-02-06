import mongoose from "mongoose";

const UserProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    trackSlug: { type: String, required: true, trim: true },

    exerciseSlug: { type: String, default: null, trim: true },

    // "practice" | "concept" | "track"
    category: { type: String, default: "practice", trim: true },

    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
    },

    completedAt: { type: Date },
  },
  { timestamps: true },
);

UserProgressSchema.index(
  { user: 1, trackSlug: 1, category: 1, exerciseSlug: 1 },
  { unique: true },
);

export default mongoose.model("UserProgress", UserProgressSchema);
