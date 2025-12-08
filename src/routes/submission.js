import express from "express";
import { submitSolution } from "../controllers/submission.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

router.post("/", protect, submitSolution);

export default router;
