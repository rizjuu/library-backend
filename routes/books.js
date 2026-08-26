const express = require("express");
const Book = require("../models/Book");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

const barcodeRoles = authorize("admin", "staff");

const buildBarcodeItems = (startNumber, count, prefix) => Array.from({ length: count }, (_, index) => {
  const sequence = String(startNumber + index).padStart(6, "0");
  return {
    accessionNumber: `${prefix}-${sequence}`,
    barcode: `LIB-${sequence}`
  };
});

// Generate sequential accession numbers and barcodes without creating book records
router.post("/barcodes/generate", protect, barcodeRoles, async (req, res) => {
  try {
    const count = Math.min(Math.max(Number(req.body.count) || 1, 1), 100);
    const prefix = String(req.body.prefix || "ACC").trim().toUpperCase().replace(/[^A-Z0-9-]/g, "") || "ACC";
    const existingBooks = await Book.find({}, "accessionNumber barcode").lean();
    const usedAccessions = new Set(existingBooks.map((book) => book.accessionNumber).filter(Boolean));
    const usedBarcodes = new Set(existingBooks.map((book) => book.barcode).filter(Boolean));
    let sequence = existingBooks.reduce((highest, book) => {
      const match = String(book.barcode || "").match(/^LIB-(\d+)$/);
      return match ? Math.max(highest, Number(match[1])) : highest;
    }, 0) + 1;
    const generated = [];

    while (generated.length < count) {
      const item = buildBarcodeItems(sequence, 1, prefix)[0];
      sequence += 1;
      if (!usedAccessions.has(item.accessionNumber) && !usedBarcodes.has(item.barcode)) {
        generated.push(item);
        usedAccessions.add(item.accessionNumber);
        usedBarcodes.add(item.barcode);
      }
    }

    res.json({ items: generated });
  } catch (error) {
    console.error("Error generating barcodes:", error);
    res.status(500).json({ message: "Failed to generate barcodes" });
  }
});

// GET all books sorted by dateAdded / createdAt desc
router.get("/", async (req, res) => {
  try {
    const books = await Book.find({ archived: { $ne: true } }).sort({ createdAt: -1 });
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
    const book = await Book.findOne({ barcode: req.params.barcode, archived: { $ne: true } });
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }
    res.json(book);
  } catch (error) {
    res.status(500).json({ message: "Error looking up barcode" });
  }
});

// Assign a generated accession number and barcode to an existing book
router.patch("/:id/assign-barcode", protect, barcodeRoles, async (req, res) => {
  try {
    const accessionNumber = String(req.body.accessionNumber || "").trim();
    const barcode = String(req.body.barcode || "").trim();
    if (!accessionNumber || !barcode) {
      return res.status(400).json({ message: "Accession number and barcode are required" });
    }

    const duplicate = await Book.findOne({
      $or: [{ accessionNumber }, { barcode }],
      _id: { $ne: req.params.id }
    });
    if (duplicate) {
      return res.status(409).json({ message: "Accession number or barcode is already assigned" });
    }

    const book = await Book.findOneAndUpdate(
      { _id: req.params.id, archived: { $ne: true } },
      { $set: { accessionNumber, barcode } },
      { new: true, runValidators: true }
    );
    if (!book) return res.status(404).json({ message: "Active book not found" });
    res.json({ message: "Barcode assigned successfully", book });
  } catch (error) {
    console.error("Error assigning barcode:", error);
    res.status(500).json({ message: "Failed to assign barcode" });
  }
});

// GET archived books for the admin Weeding page
router.get("/archived", protect, authorize("admin"), async (req, res) => {
  try {
    const books = await Book.find({ archived: true })
      .populate("archivedBy", "name email")
      .sort({ archivedAt: -1, updatedAt: -1 });
    res.json(books);
  } catch (error) {
    console.error("Error fetching archived books:", error);
    res.status(500).json({ message: "Failed to fetch archived books" });
  }
});

// Archive a book without deleting its catalog record (admins only)
router.patch("/:id/archive", protect, authorize("admin"), async (req, res) => {
  try {
    const book = await Book.findOneAndUpdate(
      { _id: req.params.id, archived: { $ne: true } },
      {
        $set: {
          archived: true,
          archivedAt: new Date(),
          archivedBy: req.user._id
        }
      },
      { new: true }
    );

    if (!book) {
      return res.status(404).json({ message: "Book not found or already archived" });
    }

    res.json({ message: "Book archived successfully", book });
  } catch (error) {
    console.error("Error archiving book:", error);
    res.status(500).json({ message: "Failed to archive book" });
  }
});

module.exports = router;