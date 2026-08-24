const express = require("express");
const Book = require("../models/Book");

const router = express.Router();

// GET all books sorted by dateAdded / createdAt desc
router.get("/", async (req, res) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.json(books);
  } catch (error) {
    console.error("Error fetching books:", error);
    res.status(500).json({ message: "Failed to fetch books" });
  }
});

// POST add new book (All 10 fields supported)
router.post("/", async (req, res) => {
  try {
    const {
      isbn,
      barcode,
      title,
      author,
      authors,
      category,
      publisher,
      publicationYear,
      shelf,
      status,
      dateAdded
    } = req.body;

    if (!barcode || !title) {
      return res.status(400).json({ message: "Barcode and Title are required" });
    }

    const existingBarcode = await Book.findOne({ barcode: barcode.trim() });
    if (existingBarcode) {
      return res.status(400).json({ message: `Book with barcode "${barcode.trim()}" already exists` });
    }

    const isAvailable = status ? status === "available" : true;

    const book = await Book.create({
      isbn: (isbn || "").trim(),
      barcode: barcode.trim(),
      title: title.trim(),
      author: (author || "").trim() || "Unknown Author",
      authors: Array.isArray(authors) ? authors : author ? [author] : [],
      category: (category || "").trim() || "General",
      publisher: (publisher || "").trim() || "N/A",
      publicationYear: publicationYear ? Number(publicationYear) : null,
      shelf: (shelf || "").trim() || "General Shelf",
      status: status || "available",
      available: isAvailable,
      dateAdded: dateAdded ? new Date(dateAdded) : new Date()
    });

    res.status(201).json(book);
  } catch (error) {
    console.error("Error creating book:", error);
    res.status(500).json({ message: "Failed to add book", error: error.message });
  }
});

// GET book by barcode
router.get("/barcode/:barcode", async (req, res) => {
  try {
    const book = await Book.findOne({ barcode: req.params.barcode });
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: "Error looking up barcode" });
  }
});

module.exports = router;