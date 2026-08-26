const mongoose = require("mongoose");

const bookSchema = new mongoose.Schema(
  {
    isbn: {
      type: String,
      trim: true,
      default: ""
    },

    barcode: {
      type: String,
      unique: true,
      sparse: true,
      required: true,
      trim: true
    },

    accessionNumber: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    author: {
      type: String,
      trim: true,
      default: "Unknown"
    },

    authors: [
      {
        type: String,
        trim: true
      }
    ],

    category: {
      type: String,
      trim: true,
      default: "General"
    },

    publisher: {
      type: String,
      trim: true,
      default: "N/A"
    },

    publicationYear: {
      type: Number,
      default: null
    },

    shelf: {
      type: String,
      trim: true,
      default: "General Shelf"
    },

    status: {
      type: String,
      enum: ["available", "borrowed", "maintenance", "reserved"],
      default: "available"
    },

    available: {
      type: Boolean,
      default: true
    },

    dateAdded: {
      type: Date,
      default: Date.now
    },

    description: {
      type: String,
      default: ""
    },

    coverUrl: {
      type: String,
      default: ""
    },

    openLibraryKey: {
      type: String,
      default: ""
    },

    source: {
      type: String,
      default: "manual"
    },

    condition: {
      type: String,
      default: "Good"
    },

    copies: {
      type: Number,
      default: 1
    },

    borrowable: {
      type: Boolean,
      default: true
    },

    archived: {
      type: Boolean,
      default: false
    },

    archivedAt: {
      type: Date,
      default: null
    },

    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Book", bookSchema);