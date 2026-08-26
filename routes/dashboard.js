const express = require("express");
const Book = require("../models/Book");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const Announcement = require("../models/Announcement");

const router = express.Router();

// GET /api/dashboard/stats - Returns live metrics from MongoDB
router.get("/stats", async (req, res) => {
  try {
    const now = new Date();

    const [
      totalBooks,
      availableBooks,
      borrowedBooks,
      overdueBooks,
      totalUsers,
      totalPatrons,
      totalStaff,
      recentTransactions,
      announcements
    ] = await Promise.all([
      Book.countDocuments({ archived: { $ne: true } }),
      Book.countDocuments({ archived: { $ne: true }, available: { $ne: false } }),
      Book.countDocuments({ archived: { $ne: true }, available: false }),
      Transaction.countDocuments({ returned: false, dueDate: { $lt: now } }),
      User.countDocuments(),
      User.countDocuments({ role: "patron" }),
      User.countDocuments({ role: "staff" }),
      Transaction.find()
        .populate("bookId", "title barcode category author")
        .sort({ createdAt: -1 })
        .limit(10),
      Announcement.find({ active: true }).sort({ createdAt: -1 })
    ]);

    res.json({
      totalBooks,
      availableBooks,
      borrowedBooks,
      overdueBooks,
      totalUsers,
      totalPatrons,
      totalStaff,
      recentTransactions,
      announcements
    });
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({ message: "Failed to fetch dashboard stats", error: error.message });
  }
});

module.exports = router;
