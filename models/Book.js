const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema({
  
  barcode: { type: String, required: true, unique: true },
  title: String,
  author: String,
  category: String,
  shelf: String,
  available: {
    type: Boolean,
    default: true
  },
   title: {
      type: String,
      required: true,
    },

    authors: [
      {
        type: String,
      },
    ],

    isbn: {
      type: String,
    },

    publisher: {
      type: String,
    },

    publicationYear: {
      type: Number,
    },

    category: {
      type: String,
    },

    description: {
      type: String,
    },

    coverUrl: {
      type: String,
    },

    openLibraryKey: {
      type: String,
    },

    source: {
      type: String,
      default: "manual",
    },

    barcode: {
      type: String,
      unique: true,
      sparse: true,
    },

    shelf: {
      type: String,
    },

    condition: {
      type: String,
      default: "Good",
    },

    copies: {
      type: Number,
      default: 1,
    },

    status: {
      type: String,
      default: "available",
    },

    borrowable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }

);

module.exports = mongoose.model("Book", bookSchema);