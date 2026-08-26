const express = require("express");
const Book = require("../models/Book");
const Transaction = require("../models/Transaction");

const router = express.Router();

// GET all transactions populated with Book info
router.get("/", async (req, res) => {
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

// POST borrow a book
router.post("/borrow", async (req, res) => {
  try {
    const { barcode, borrowerName, borrowerEmail, dueDate } = req.body;

    const book = await Book.findOne({ barcode, archived: { $ne: true } });

    if (!book) {
      return res.status(404).json({ message: "Book not found with provided barcode" });
    }

    if (book.available === false) {
      return res.status(400).json({ message: `Book "${book.title}" is currently unavailable/borrowed` });
    }

    const calculatedDueDate = dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 86400000);

    const transaction = await Transaction.create({
      bookId: book._id,
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

// POST return a book
router.post("/return", async (req, res) => {
  try {
    const { barcode } = req.body;

    const book = await Book.findOne({ barcode });

    if (!book) {
      return res.status(404).json({ message: "Book not found with provided barcode" });
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