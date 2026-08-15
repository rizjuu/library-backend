const express = require("express");
const Book = require("../models/Book");
const Transaction = require("../models/Transaction");

const router = express.Router();

router.post("/borrow", async (req, res) => {
  const book = await Book.findOne({
    barcode: req.body.barcode
  });

  if (!book || !book.available) {
    return res.status(400).json({
      message: "Book unavailable"
    });
  }

  const transaction = await Transaction.create({
    bookId: book._id,
    borrowerName: req.body.borrowerName,
    dueDate: req.body.dueDate
  });

  book.available = false;
  await book.save();

  res.json(transaction);
});

router.post("/return", async (req, res) => {
  const book = await Book.findOne({
    barcode: req.body.barcode
  });

  book.available = true;
  await book.save();

  await Transaction.findOneAndUpdate(
    {
      bookId: book._id,
      returned: false
    },
    {
      returned: true
    }
  );

  res.json({
    message: "Book returned"
  });
});

module.exports = router;