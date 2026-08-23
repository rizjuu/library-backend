const mongoose = require("mongoose");
require("dotenv").config();

const Book = require("./models/Book");
const Transaction = require("./models/Transaction");
const User = require("./models/User");
const Announcement = require("./models/Announcement");

async function seedDashboardData() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB for Dashboard Seeding...");

    // 1. Seed Announcements
    const announcementCount = await Announcement.countDocuments();
    if (announcementCount === 0) {
      await Announcement.create([
        {
          title: "Extended Public Library Operating Hours",
          content: "Starting June 1, the Misamis Oriental Provincial Capitol Public Library will remain open until 8:00 PM on weekdays.",
          priority: "high",
          author: "Head Librarian",
          date: "2026-05-20"
        },
        {
          title: "New Filipiniana & Historical Collection",
          content: "120 new titles have been cataloged and added to the Filipiniana shelf section for public research and loaning.",
          priority: "normal",
          author: "Cataloging Dept",
          date: "2026-05-18"
        },
        {
          title: "Passwordless Email Login & SMS Alerts Active",
          content: "Library patrons can now log in using passwordless email authentication and receive automated loan due date alerts.",
          priority: "normal",
          author: "IT System Admin",
          date: "2026-05-15"
        }
      ]);
      console.log("Announcements seeded successfully!");
    } else {
      console.log(`Found ${announcementCount} existing announcements in MongoDB.`);
    }

    // 2. Ensure initial books exist
    let sampleBooks = await Book.find();
    if (sampleBooks.length === 0) {
      sampleBooks = await Book.create([
        { barcode: "LIB-0001", title: "To Kill a Mockingbird", author: "Harper Lee", category: "Fiction", shelf: "Shelf A-1", available: true },
        { barcode: "LIB-0002", title: "1984", author: "George Orwell", category: "Classics", shelf: "Shelf B-2", available: false },
        { barcode: "LIB-0003", title: "Introduction to Algorithms", author: "Thomas H. Cormen", category: "Technology", shelf: "Shelf C-3", available: false },
        { barcode: "LIB-0004", title: "Clean Code", author: "Robert C. Martin", category: "Technology", shelf: "Shelf C-4", available: true },
        { barcode: "LIB-0005", title: "Cosmos", author: "Carl Sagan", category: "Science", shelf: "Shelf D-1", available: true }
      ]);
      console.log("Sample books seeded successfully!");
    }

    // 3. Seed Transactions if missing or overdue examples needed
    const txCount = await Transaction.countDocuments();
    if (txCount === 0 && sampleBooks.length >= 2) {
      const book2 = sampleBooks[1]; // 1984 (borrowed & overdue)
      const book3 = sampleBooks[2]; // Algorithms (borrowed active)

      const pastDate = new Date(Date.now() - 5 * 86400000); // 5 days ago (Overdue)
      const futureDate = new Date(Date.now() + 7 * 86400000); // 7 days from now (Active)

      await Transaction.create([
        {
          bookId: book2._id,
          borrowerName: "Juan Dela Cruz",
          borrowerEmail: "juan.delacruz@example.com",
          dueDate: pastDate,
          returned: false,
          type: "Borrow"
        },
        {
          bookId: book3._id,
          borrowerName: "Maria Santos",
          borrowerEmail: "maria.santos@example.com",
          dueDate: futureDate,
          returned: false,
          type: "Borrow"
        }
      ]);
      console.log("Sample transactions seeded successfully!");
    } else {
      console.log(`Found ${txCount} existing transactions in MongoDB.`);
    }

    console.log("Dashboard Seeding Completed!");
  } catch (error) {
    console.error("Seeding error:", error);
  } finally {
    await mongoose.disconnect();
  }
}

seedDashboardData();
