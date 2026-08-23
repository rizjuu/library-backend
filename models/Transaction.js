const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    bookId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Book",
      required: true
    },
    borrowerName: {
      type: String,
      required: true
    },
    borrowerEmail: {
      type: String,
      lowercase: true,
      trim: true
    },
    dueDate: {
      type: Date,
      required: true
    },
    returned: {
      type: Boolean,
      default: false
    },
    returnDate: {
      type: Date
    },
    type: {
      type: String,
      enum: ["Borrow", "Return"],
      default: "Borrow"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Transaction", transactionSchema);