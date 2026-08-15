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
  }
});

module.exports = mongoose.model("Book", bookSchema);