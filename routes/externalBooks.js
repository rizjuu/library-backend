const express = require("express");
const axios = require("axios");
const Book = require("../models/Book");

const router = express.Router();

const OPEN_LIBRARY_URL = "https://openlibrary.org/search.json";

const USER_AGENT =
  process.env.OPENLIBRARY_USER_AGENT ||
  "Library Management System/1.0 (jeowenn@gmail.com)";

// ==========================================
// IMPORT BOOK TO MONGODB (Maps all 10 fields)
// ==========================================
router.post("/import", async (req, res) => {
  try {
    const {
      title,
      author,
      authors,
      isbn,
      publisher,
      publicationYear,
      category,
      coverUrl,
      openLibraryKey,
      shelf,
      condition,
      copies,
      barcode,
      status,
      dateAdded
    } = req.body;

    if (!title) {
      return res.status(400).json({
        message: "Book title is required"
      });
    }

    if (openLibraryKey) {
      const existingBook = await Book.findOne({ openLibraryKey });
      if (existingBook) {
        return res.status(409).json({
          message: "This book has already been imported",
          book: existingBook
        });
      }
    }

    // Determine clean author string
    const authorsArr = Array.isArray(authors) ? authors : authors ? [authors] : [];
    const mainAuthor = author || (authorsArr.length > 0 ? authorsArr.join(", ") : "Unknown Author");

    // Clean ISBN representation
    const mainIsbn = Array.isArray(isbn) ? isbn[0] : isbn || "";

    // Generate fallback barcode if missing
    const generatedBarcode = barcode || `LIB-IMP-${Math.floor(1000 + Math.random() * 9000)}`;

    const book = await Book.create({
      title: title.trim(),
      author: mainAuthor,
      authors: authorsArr,
      isbn: mainIsbn,
      publisher: publisher || "N/A",
      publicationYear: publicationYear ? Number(publicationYear) : null,
      category: category || "General",
      shelf: shelf || "General Shelf",
      status: status || "available",
      available: status === "borrowed" ? false : true,
      dateAdded: dateAdded ? new Date(dateAdded) : new Date(),
      coverUrl: coverUrl || "",
      openLibraryKey: openLibraryKey || "",
      source: "openlibrary",
      barcode: generatedBarcode,
      condition: condition || "Good",
      copies: copies || 1,
      borrowable: true
    });

    res.status(201).json({
      message: "Book successfully imported to catalog!",
      book
    });
  } catch (error) {
    console.error("Book import error:", error);
    res.status(500).json({
      message: "Failed to import book",
      error: error.message
    });
  }
});

// ==========================================
// SEARCH OPEN LIBRARY BY KEYWORD
// ==========================================
router.get("/search", async (req, res) => {
  try {
    const query = req.query.q;

    if (!query || !query.trim()) {
      return res.status(400).json({
        message: "Search query is required"
      });
    }

    const url = new URL(OPEN_LIBRARY_URL);
    url.searchParams.set("q", query);
    url.searchParams.set(
      "fields",
      "key,title,author_name,first_publish_year,isbn,cover_i,publisher,subject"
    );
    url.searchParams.set("limit", "20");

    const response = await axios.get(url.toString(), {
      timeout: 15000,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json"
      }
    });

    const data = response.data;

    const books = (data.docs || []).map((book) => ({
      openLibraryKey: book.key || null,
      title: book.title || "Unknown Title",
      author: book.author_name ? book.author_name.join(", ") : "Unknown Author",
      authors: book.author_name || [],
      publicationYear: book.first_publish_year || null,
      isbn: book.isbn ? (Array.isArray(book.isbn) ? book.isbn[0] : book.isbn) : "",
      publisher: book.publisher ? (Array.isArray(book.publisher) ? book.publisher[0] : book.publisher) : "N/A",
      category: book.subject ? book.subject[0] : "General",
      subjects: book.subject ? book.subject.slice(0, 5) : [],
      coverId: book.cover_i || null,
      coverUrl: book.cover_i
        ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
        : null
    }));

    res.json({
      total: data.numFound || 0,
      books
    });
  } catch (error) {
    console.error("Open Library search error:", error);
    res.status(500).json({
      message: "Failed to search Open Library",
      error: error.message
    });
  }
});

// ==========================================
// ISBN LOOKUP
// ==========================================
router.get("/isbn/:isbn", async (req, res) => {
  try {
    const isbnStr = req.params.isbn.replace(/[^0-9Xx]/g, "");

    if (!isbnStr) {
      return res.status(400).json({
        message: "ISBN is required"
      });
    }

    const url = new URL(OPEN_LIBRARY_URL);
    url.searchParams.set("isbn", isbnStr);
    url.searchParams.set(
      "fields",
      "key,title,author_name,first_publish_year,isbn,publisher,cover_i,subject"
    );
    url.searchParams.set("limit", "10");

    const response = await axios.get(url.toString(), {
      timeout: 15000,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json"
      }
    });

    const data = response.data;

    if (!data.docs || !data.docs.length) {
      return res.status(404).json({
        message: "Book not found for this ISBN"
      });
    }

    const book = data.docs[0];

    res.json({
      openLibraryKey: book.key || null,
      title: book.title || "Unknown Title",
      author: book.author_name ? book.author_name.join(", ") : "Unknown Author",
      authors: book.author_name || [],
      isbn: isbnStr,
      publisher: book.publisher ? (Array.isArray(book.publisher) ? book.publisher[0] : book.publisher) : "N/A",
      publicationYear: book.first_publish_year || null,
      category: book.subject ? book.subject[0] : "General",
      coverUrl: book.cover_i
        ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
        : null,
      subjects: book.subject || []
    });
  } catch (error) {
    console.error("ISBN lookup error:", error);
    res.status(500).json({
      message: "ISBN lookup failed",
      error: error.message
    });
  }
});

module.exports = router;