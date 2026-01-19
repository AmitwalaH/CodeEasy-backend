import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import progressRoutes from "./routes/progress.js";
import trackRoutes from "./routes/track.js";
import errorHandler from "./middlewares/errorHandler.js";
// import submissionRoutes from "./routes/submission.js";
import submissionRoutes from "./routes/submissionRoutes.js";
// import conceptRoutes from "./routes/conceptRoutes.js";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use("/public", express.static(path.join(__dirname, "..", "public")));
app.use("/api/auth", authRoutes);
app.use("/api/progress", progressRoutes);
app.use("/api/tracks", trackRoutes);
// app.use("/api/tracks", conceptRoutes);
app.use("/api/submissions", submissionRoutes);

app.get("/", (req, res) => {
  res.json({ message: "CodeEasy API running..." });
});
app.use(errorHandler);

export default app;
