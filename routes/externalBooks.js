const express = require("express");
const axios = require("axios");
const Book = require("../models/Book");

const router = express.Router();

const OPEN_LIBRARY_URL =
  "https://openlibrary.org/search.json";

const USER_AGENT =
  process.env.OPENLIBRARY_USER_AGENT ||
  "Library Management System/1.0 (jeowenn@gmail.com)";

// ==========================================
// IMPORT BOOK TO MONGODB
// ==========================================
router.post("/import", async (req, res) => {
  try {
    const {
      title,
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
    } = req.body;

    if (!title) {
      return res.status(400).json({
        message: "Book title is required",
      });
    }

    if (openLibraryKey) {
      const existingBook = await Book.findOne({
        openLibraryKey,
      });

      if (existingBook) {
        return res.status(409).json({
          message: "This book has already been imported",
          book: existingBook,
        });
      }
    }

    const book = await Book.create({
      title,
      authors: authors || [],
      isbn,
      publisher,
      publicationYear,
      category,
      coverUrl,
      openLibraryKey,
      source: "openlibrary",

      shelf,
      condition: condition || "Good",
      copies: copies || 1,
      barcode,
      status: "available",
      borrowable: true,
    });

    res.status(201).json({
      message: "Book successfully imported",
      book,
    });
  } catch (error) {
    console.error("Book import error:", error);

    res.status(500).json({
      message: "Failed to import book",
      error: error.message,
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
        message: "Search query is required",
      });
    }

    const url = new URL(OPEN_LIBRARY_URL);
    url.searchParams.set("q", query);
    url.searchParams.set(
      "fields",
      "key,title,author_name,first_publish_year,isbn,cover_i,publisher,subject"
    );
    url.searchParams.set("limit", "20");

    console.log("Searching Open Library:", url.toString());

    const response = await axios.get(url.toString(), {
      timeout: 15000,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });

    const data = response.data;

    const books = data.docs.map((book) => ({
      openLibraryKey: book.key || null,
      title: book.title || "Unknown Title",
      authors: book.author_name || [],
      publicationYear: book.first_publish_year || null,
      isbn: book.isbn ? book.isbn.slice(0, 5) : [],
      publisher: book.publisher?.[0] || null,
      subjects: book.subject ? book.subject.slice(0, 10) : [],
      coverId: book.cover_i || null,
      coverUrl: book.cover_i
        ? `https://covers.openlibrary.org/b/id/${book.cover_i}-M.jpg`
        : null,
    }));

    console.log(`Open Library returned ${books.length} books`);

    res.json({
      total: data.numFound || 0,
      books,
    });
  } catch (error) {
    console.error("Open Library search error:", error);

    res.status(500).json({
      message: "Failed to search Open Library",
      error: error.message,
    });
  }
});

// ==========================================
// ISBN LOOKUP
// ==========================================
router.get("/isbn/:isbn", async (req, res) => {
  try {
    const isbn = req.params.isbn.replace(/[^0-9Xx]/g, "");

    if (!isbn) {
      return res.status(400).json({
        message: "ISBN is required",
      });
    }

    const url = new URL(OPEN_LIBRARY_URL);
    url.searchParams.set("isbn", isbn);
    url.searchParams.set(
      "fields",
      "key,title,author_name,first_publish_year,isbn,publisher,cover_i,subject"
    );
    url.searchParams.set("limit", "10");

    console.log("ISBN lookup Open Library:", url.toString());

    const response = await axios.get(url.toString(), {
      timeout: 15000,
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
    });

    const data = response.data;

    if (!data.docs || !data.docs.length) {
      return res.status(404).json({
        message: "Book not found for this ISBN",
      });
    }

    const book = data.docs[0];

    res.json({
      openLibraryKey: book.key || null,
      title: book.title || "Unknown Title",
      authors: book.author_name || [],
      isbn: book.isbn || [isbn],
      publisher: book.publisher?.[0] || null,
      publicationYear: book.first_publish_year || null,
      coverUrl: book.cover_i
        ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
        : null,
      subjects: book.subject || [],
    });
  } catch (error) {
    console.error("ISBN lookup error:", error);

    res.status(500).json({
      message: "ISBN lookup failed",
      error: error.message,
    });
  }
});

module.exports = router;