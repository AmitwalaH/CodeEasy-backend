import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import progressRoutes from "./routes/progress.js";
import errorHandler from "./middlewares/errorHandler.js";

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/progress", progressRoutes);

// Healt    h check
app.get("/", (req, res) => {
  res.json({ message: "CodeEasy API running..." });
});
app.use(errorHandler);

export default app;
