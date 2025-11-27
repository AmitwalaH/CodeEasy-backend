export default function errorHandler(err, req, res, next) {
  console.error("🔥 Error:", err);

  res.status(500).json({
    message: "Server error",
    error: err.message || "Unknown error",
  });
}
