const express = require("express");
const Book = require("../models/Book");

const router = express.Router();

router.get("/", async (req, res) => {
  const books = await Book.find();
  res.json(books);
});

router.post("/", async (req, res) => {
  const book = await Book.create(req.body);
  res.json(book);
});

router.get("/barcode/:barcode", async (req, res) => {
  const book = await Book.findOne({
    barcode: req.params.barcode
  });

  res.json(book);
});

module.exports = router;