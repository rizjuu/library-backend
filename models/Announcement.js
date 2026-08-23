const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    date: {
      type: String,
      default: () => new Date().toISOString().split("T")[0]
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high"],
      default: "normal"
    },
    author: {
      type: String,
      default: "Library Admin"
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Announcement", announcementSchema);
