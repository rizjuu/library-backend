const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Book"
  },
  borrowerName: String,
  dueDate: Date,
  returned: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model(
  "Transaction",
  transactionSchema
);