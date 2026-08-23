const express = require("express");
const Announcement = require("../models/Announcement");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// GET all active announcements (Open/Read-Only for Admin, Staff, Patron)
router.get("/", async (req, res) => {
  try {
    const announcements = await Announcement.find({ active: true }).sort({ createdAt: -1 });
    res.json(announcements);
  } catch (error) {
    console.error("Error fetching announcements:", error);
    res.status(500).json({ message: "Failed to fetch announcements" });
  }
});

// POST create new announcement (ADMIN ONLY)
router.post("/", protect, authorize("admin"), async (req, res) => {
  try {
    const { title, content, priority, author, date } = req.body;
    if (!title || !content) {
      return res.status(400).json({ message: "Title and content are required" });
    }

    const announcement = await Announcement.create({
      title: title.trim(),
      content: content.trim(),
      priority: priority || "normal",
      author: author || req.user?.name || "Library Admin",
      date: date || new Date().toISOString().split("T")[0]
    });

    res.status(201).json(announcement);
  } catch (error) {
    console.error("Error creating announcement:", error);
    res.status(500).json({ message: "Failed to create announcement" });
  }
});

// DELETE announcement (ADMIN ONLY)
router.delete("/:id", protect, authorize("admin"), async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) {
      return res.status(404).json({ message: "Announcement not found" });
    }
    res.json({ message: "Announcement deleted successfully", id: req.params.id });
  } catch (error) {
    console.error("Error deleting announcement:", error);
    res.status(500).json({ message: "Failed to delete announcement" });
  }
});

module.exports = router;
