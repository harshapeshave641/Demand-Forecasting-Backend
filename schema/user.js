const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    fullName: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true } // 👈 Auto-manages createdAt & updatedAt
);

const User = mongoose.model("User", userSchema);

module.exports = User;
