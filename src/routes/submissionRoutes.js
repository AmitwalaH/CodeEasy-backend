import express from "express";
import { submitCode } from "../controllers/submission.js";

const router = express.Router();

// POST /api/submissions
router.post("/", submitCode);

export default router;
