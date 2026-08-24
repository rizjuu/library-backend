const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      unique: true,
      sparse: true
    },

    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true
    },

    avatar: {
      type: String
    },

    role: {
      type: String,
      enum: ["admin", "staff", "patron"],
      required: true
    },

    name: {
      type: String,
      required: true
    },

    phone: {
      type: String,
      trim: true,
      default: ""
    },

    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("User", userSchema);