import UserProgress from "../routes/progress.js";

// POST /api/progress/complete
export const markCompleted = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { trackSlug, exerciseSlug } = req.body;
    if (!trackSlug || !exerciseSlug) {
      return res
        .status(400)
        .json({ error: "trackSlug and exerciseSlug required" });
    }

    const progress = await UserProgress.findOneAndUpdate(
      { user: userId, trackSlug, exerciseSlug },
      { status: "completed", completedAt: Date.now() },
      { upsert: true, new: true }
    );
    res.status(200).json({ message: "Exercise marked as completed", progress });
  } catch (err) {
    next(err);
  }
};

// GET /api/progress/my-progress
export const getMyProgress = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const progresses = await UserProgress.find({ user: userId }).lean();
    res.status(200).json({ progresses });
  } catch (err) {
    next(err);
  }
};
