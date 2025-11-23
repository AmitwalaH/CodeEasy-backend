import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true
    },
    password: {
      type: String,
      required: function () {
        return !this.googleId && !this.githubId;
      }
    },
    avatar: {
      type: String,
      default: ""
    },
    googleId: {
      type: String,
      default: null
    },
    githubId: {
      type: String,
      default: null
    },
    languagesCompleted: {
      type: [String],
      default: []
    },
    exercisesCompleted: {
      type: [String],
      default: []
    },

    // recommended additional fields
    emailVerified: {
      type: Boolean,
      default: false
    },
    isBlocked: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

// HASH PASSWORD BEFORE SAVE
UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// CHECK PASSWORD (for login)
UserSchema.methods.comparePassword = async function (plaintext) {
  return bcrypt.compare(plaintext, this.password);
};

// GENERATE JWT TOKEN
UserSchema.methods.generateJWT = function () {
  return jwt.sign(
    { id: this._id, email: this.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

export default mongoose.model("User", UserSchema);
