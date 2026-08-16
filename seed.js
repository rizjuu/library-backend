const mongoose = require("mongoose");
require("dotenv").config();

const Book = require("./models/Book");

const books = [
  {
    barcode: "LIB-0001",
    title: "Jeoriz Gwapo kaayu",
    author: "Jeoriz Gardones Honculada",
    category: "Classic",
    shelf: "A-01",
    available: true
  },
  {
    barcode: "LIB-0002",
    title: "To Kill a Mockingbird",
    author: "Harper Lee",
    category: "Fiction",
    shelf: "A-02",
    available: true
  },
  {
    barcode: "LIB-0003",
    title: "1984",
    author: "George Orwell",
    category: "Dystopian",
    shelf: "B-01",
    available: true
  },
  {
    barcode: "LIB-0004",
    title: "Pride and Prejudice",
    author: "Jane Austen",
    category: "Romance",
    shelf: "B-02",
    available: true
  },
  {
    barcode: "LIB-0005",
    title: "The Hobbit",
    author: "J. R. R. Tolkien",
    category: "Fantasy",
    shelf: "C-01",
    available: true
  }
];

async function seedDatabase() {
  try {
    console.log("Connecting to MongoDB...");

    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to MongoDB!");

    console.log(
      "Database:",
      mongoose.connection.name
    );

    console.log("Deleting old books...");

    await Book.deleteMany({});

    console.log("Old books deleted.");

    console.log("Adding 5 books...");

    const insertedBooks = await Book.insertMany(books);

    console.log(
      `${insertedBooks.length} books successfully added!`
    );

    console.log("Books:");

    insertedBooks.forEach((book) => {
      console.log(
        `${book.barcode} - ${book.title}`
      );
    });

  } catch (error) {
    console.error("SEED ERROR:");
    console.error(error);
  } finally {
    await mongoose.disconnect();

    console.log("MongoDB connection closed.");
  }
}

seedDatabase();