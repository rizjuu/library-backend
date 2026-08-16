const mongoose = require("mongoose");
require("dotenv").config();

const User = require("./models/User");

async function seedPatron() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to MongoDB");

    await User.deleteOne({
      email: "patron@example.com"
    });

    await User.create({
      email: "patron@example.com",
      role: "patron",
      name: "Juan Dela Cruz"
    });

    console.log("Patron created!");

    console.log("Email: patron@example.com");

  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

seedPatron();