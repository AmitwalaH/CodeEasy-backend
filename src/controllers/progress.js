// controllers/progress.js
import UserProgress from "../models/UserProgress.js";

//  POST /api/tracks/:slug/join
export const joinTrack = async (req, res, next) => {
  try {
    const userId = req.user._id;

    // 
    const trackSlug = req.params.slug;

    if (!trackSlug) {
      return res
        .status(400)
        .json({ success: false, error: "trackSlug required" });
    }

    // create "joined track" record (only once per user per track)
    await UserProgress.updateOne(
      { user: userId, trackSlug, category: "track", exerciseSlug: null },
      { $setOnInsert: { status: "in_progress" } },
      { upsert: true }
    );

    return res.status(200).json({ success: true, message: "Track joined" });
  } catch (err) {
    next(err);
  }
};


//  NEW: POST /api/progress/start
export const startExercise = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { trackSlug, category, exerciseSlug } = req.body;

    if (!trackSlug || !exerciseSlug) {
      return res.status(400).json({
        success: false,
        error: "trackSlug and exerciseSlug required",
      });
    }

    // If already completed, don't downgrade it back to in_progress
    const existing = await UserProgress.findOne({
      user: userId,
      trackSlug,
      exerciseSlug,
    }).lean();

    if (existing && existing.status === "completed") {
      return res.status(200).json({
        success: true,
        message: "Exercise already completed",
        data: existing,
      });
    }

    const progress = await UserProgress.findOneAndUpdate(
      { user: userId, trackSlug, exerciseSlug },
      {
        status: "in_progress",
        category: category || "practice",
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Exercise marked as in progress",
      data: progress,
    });
  } catch (err) {
    next(err);
  }
};

//  POST /api/progress/complete
export const markCompleted = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { trackSlug, category, exerciseSlug } = req.body;

    if (!trackSlug || !exerciseSlug) {
      return res
        .status(400)
        .json({ success: false, error: "trackSlug and exerciseSlug required" });
    }

    const progress = await UserProgress.findOneAndUpdate(
      { user: userId, trackSlug, exerciseSlug },
      {
        status: "completed",
        completedAt: Date.now(),
        category: category || "practice",
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: "Exercise marked as completed",
      data: progress,
    });
  } catch (err) {
    next(err);
  }
};

//  GET /api/progress/my-progress
export const getMyProgress = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const progresses = await UserProgress.find({ user: userId }).lean();

    return res.status(200).json({
      success: true,
      data: progresses,
    });
  } catch (err) {
    next(err);
  }
};
