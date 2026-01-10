import UserProgress from "../models/UserProgress.js"; // CORRECT

// POST /api/progress/complete
export const markCompleted = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { trackSlug, category, exerciseSlug } = req.body;  // Added category
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
        category: category || "practice"  // Store category too
      },
      { upsert: true, new: true }
    );
    res.status(200).json({ 
      success: true,
      message: "Exercise marked as completed", 
      data: progress  // Changed from 'progress' to 'data'
    });
  } catch (err) {
    next(err);
  }
};


// GET /api/progress/my-progress
export const getMyProgress = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const progresses = await UserProgress.find({ user: userId }).lean();
    res.status(200).json({
      success: true,
      data: progresses, // Changed from 'progresses' to 'data'
    });
  } catch (err) {
    next(err);
  }
};
