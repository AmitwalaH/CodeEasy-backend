import express from "express";
import { getConceptDetail } from "../controllers/conceptController.js";

const router = express.Router();

// GET /api/tracks/:trackSlug/concepts/:conceptSlug
router.get("/:trackSlug/concepts/:conceptSlug", (req, res, next) => {
  console.log("🔥 Concept route HIT", req.params);
  next();
}, getConceptDetail);
export default router;
