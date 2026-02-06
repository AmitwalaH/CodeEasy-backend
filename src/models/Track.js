import mongoose from "mongoose";

const TrackSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: { type: String, trim: true }, 
    studentCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Track", TrackSchema);
