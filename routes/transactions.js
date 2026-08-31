const express = require("express");
const Book = require("../models/Book");
const Transaction = require("../models/Transaction");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// All transaction routes require authentication
router.use(protect);

// GET all transactions populated with Book info (staff/admin only)
router.get("/", authorize("admin", "staff"), async (req, res) => {
  try {
    const transactions = await Transaction.find()
      .populate("bookId", "title barcode category author")
      .sort({ createdAt: -1 });
    res.json(transactions);
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
});

// ==========================================
// PATRON: My currently borrowed books
// ==========================================
router.get("/my-loans", async (req, res) => {
  try {
    const loans = await Transaction.find({
      $or: [
        { borrowerId: req.user._id },
        { borrowerEmail: req.user.email }
      ],
      returned: false
    })
      .populate("bookId", "title barcode category author coverUrl")
      .sort({ createdAt: -1 });
    res.json(loans);
  } catch (error) {
    console.error("Error fetching my loans:", error);
    res.status(500).json({ message: "Failed to fetch your loans" });
  }
});

// ==========================================
// PATRON: My full borrowing history
// ==========================================
router.get("/my-history", async (req, res) => {
  try {
    const history = await Transaction.find({
      $or: [
        { borrowerId: req.user._id },
        { borrowerEmail: req.user.email }
      ]
    })
      .populate("bookId", "title barcode category author coverUrl")
      .sort({ createdAt: -1 });
    res.json(history);
  } catch (error) {
    console.error("Error fetching my history:", error);
    res.status(500).json({ message: "Failed to fetch your borrowing history" });
  }
});

// ==========================================
// PATRON: My stats (active loans, returned count, next due date)
// ==========================================
router.get("/my-stats", async (req, res) => {
  try {
    const matchQuery = {
      $or: [
        { borrowerId: req.user._id },
        { borrowerEmail: req.user.email }
      ]
    };

    const [activeLoans, returnedCount, nextDueLoan] = await Promise.all([
      Transaction.countDocuments({ ...matchQuery, returned: false }),
      Transaction.countDocuments({ ...matchQuery, returned: true }),
      Transaction.findOne({ ...matchQuery, returned: false })
        .sort({ dueDate: 1 })
        .select("dueDate")
    ]);

    res.json({
      activeLoans,
      returnedCount,
      nextDueDate: nextDueLoan ? nextDueLoan.dueDate : null
    });
  } catch (error) {
    console.error("Error fetching my stats:", error);
    res.status(500).json({ message: "Failed to fetch your stats" });
  }
});

// POST borrow a book (staff/admin only)
router.post("/borrow", authorize("admin", "staff"), async (req, res) => {
  try {
    const { barcode, borrowerName, borrowerEmail, borrowerId, dueDate } = req.body;

    const book = await Book.findOne({ barcode, archived: { $ne: true } });

    if (!book) {
      return res.status(404).json({ message: "Book not found with provided barcode" });
    }

    if (book.available === false) {
      return res.status(400).json({ message: `Book "${book.title}" is currently unavailable/borrowed` });
    }

    // Validate due date if provided (cannot be in the past)
    let calculatedDueDate = new Date(Date.now() + 7 * 86400000);
    if (dueDate) {
      const parsed = new Date(dueDate);
      if (isNaN(parsed.getTime())) {
        return res.status(400).json({ message: "Invalid due date format" });
      }
      if (parsed.getTime() < Date.now() - 86400000) {
        return res.status(400).json({ message: "Due date cannot be in the past" });
      }
      calculatedDueDate = parsed;
    }

    // Resolve borrowerId: explicit id, or look up by email
    let resolvedBorrowerId = borrowerId || null;
    if (!resolvedBorrowerId && borrowerEmail) {
      const User = require("../models/User");
      const borrower = await User.findOne({ email: borrowerEmail.trim().toLowerCase() });
      if (borrower) resolvedBorrowerId = borrower._id;
    }

    const transaction = await Transaction.create({
      bookId: book._id,
      borrowerId: resolvedBorrowerId,
      borrowerName: borrowerName || "Library Patron",
      borrowerEmail: borrowerEmail || "",
      dueDate: calculatedDueDate,
      returned: false,
      type: "Borrow"
    });

    book.available = false;
    await book.save();

    const populatedTx = await Transaction.findById(transaction._id).populate("bookId", "title barcode category author");
    res.status(201).json(populatedTx);
  } catch (error) {
    console.error("Borrow transaction error:", error);
    res.status(500).json({ message: "Borrow transaction failed", error: error.message });
  }
});

// POST return a book (staff/admin only)
router.post("/return", authorize("admin", "staff"), async (req, res) => {
  try {
    const { barcode } = req.body;

    const book = await Book.findOne({ barcode });

    if (!book) {
      return res.status(404).json({ message: "Book not found with provided barcode" });
    }

    // Verify there is an active loan for this book before returning
    const activeLoan = await Transaction.findOne({
      bookId: book._id,
      returned: false
    }).sort({ createdAt: -1 });

    if (!activeLoan) {
      return res.status(400).json({ message: `Book "${book.title}" has no active loan record to return` });
    }

    book.available = true;
    await book.save();

    const transaction = await Transaction.findOneAndUpdate(
      {
        bookId: book._id,
        returned: false
      },
      {
        returned: true,
        returnDate: new Date()
      },
      { new: true, sort: { createdAt: -1 } }
    ).populate("bookId", "title barcode category author");

    res.json({
      message: `Book "${book.title}" returned successfully`,
      transaction
    });
  } catch (error) {
    console.error("Return transaction error:", error);
    res.status(500).json({ message: "Return transaction failed", error: error.message });
  }
});

module.exports = router;