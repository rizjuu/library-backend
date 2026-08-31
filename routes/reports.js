const express = require("express");
const Transaction = require("../models/Transaction");
const Book = require("../models/Book");
const User = require("../models/User");
const { protect, authorize } = require("../middleware/auth");
const { sendOverdueReminderEmail } = require("../utils/email");

const router = express.Router();

// All report routes require staff/admin access
router.use(protect, authorize("admin", "staff"));

// ==========================================
// GET /api/reports/circulation - Full circulation report data
// ==========================================
router.get("/circulation", async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate("bookId", "title barcode category author shelf")
      .sort({ createdAt: -1 });

    const now = new Date();
    const summary = {
      totalTransactions: transactions.length,
      activeLoans: transactions.filter((t) => !t.returned).length,
      returnedLoans: transactions.filter((t) => t.returned).length,
      overdueLoans: transactions.filter((t) => !t.returned && new Date(t.dueDate) < now).length
    };

    res.json({ summary, transactions });
  } catch (error) {
    console.error("Circulation report error:", error);
    res.status(500).json({ message: "Failed to generate circulation report" });
  }
});

// ==========================================
// GET /api/reports/overdue - List of overdue loans
// ==========================================
router.get("/overdue", async (req, res) => {
  try {
    const now = new Date();
    const overdue = await Transaction.find({
      returned: false,
      dueDate: { $lt: now }
    })
      .populate("bookId", "title barcode category author shelf")
      .sort({ dueDate: 1 });

    res.json(overdue);
  } catch (error) {
    console.error("Overdue report error:", error);
    res.status(500).json({ message: "Failed to generate overdue report" });
  }
});

// ==========================================
// GET /api/reports/inventory - Inventory grouped by category
// ==========================================
router.get("/inventory", async (req, res) => {
  try {
    const books = await Book.find({ archived: { $ne: true } });

    const byCategory = {};
    books.forEach((book) => {
      const cat = book.category || "General";
      if (!byCategory[cat]) {
        byCategory[cat] = { category: cat, total: 0, available: 0, borrowed: 0 };
      }
      byCategory[cat].total += 1;
      if (book.available === false) {
        byCategory[cat].borrowed += 1;
      } else {
        byCategory[cat].available += 1;
      }
    });

    res.json({
      totalTitles: books.length,
      categories: Object.values(byCategory).sort((a, b) => b.total - a.total)
    });
  } catch (error) {
    console.error("Inventory report error:", error);
    res.status(500).json({ message: "Failed to generate inventory report" });
  }
});

// ==========================================
// POST /api/reports/send-overdue-reminders - Email all overdue patrons
// ==========================================
router.post("/send-overdue-reminders", async (req, res) => {
  try {
    const now = new Date();
    const overdueLoans = await Transaction.find({
      returned: false,
      dueDate: { $lt: now }
    })
      .populate("bookId", "title barcode")
      .sort({ dueDate: 1 });

    // Group overdue loans by borrower email
    const byBorrower = {};
    overdueLoans.forEach((loan) => {
      const email = (loan.borrowerEmail || "").trim().toLowerCase();
      if (!email || !email.includes("@")) return;
      if (!byBorrower[email]) {
        byBorrower[email] = { name: loan.borrowerName, loans: [] };
      }
      byBorrower[email].loans.push(loan);
    });

    const results = { sent: 0, skipped: 0, failed: 0, details: [] };

    for (const [email, data] of Object.entries(byBorrower)) {
      const result = await sendOverdueReminderEmail(email, data.name, data.loans);
      if (result.success) {
        results.sent += 1;
      } else if (result.reason === "NO_SMTP") {
        results.skipped += 1;
        break; // No SMTP configured; don't attempt the rest
      } else {
        results.failed += 1;
      }
      results.details.push({ email, status: result.success ? "sent" : result.reason || "failed" });
    }

    res.json({
      message: `Overdue reminders processed. Sent: ${results.sent}, Failed: ${results.failed}, Skipped: ${results.skipped}`,
      overdueCount: overdueLoans.length,
      ...results
    });
  } catch (error) {
    console.error("Send overdue reminders error:", error);
    res.status(500).json({ message: "Failed to send overdue reminders" });
  }
});

module.exports = router;