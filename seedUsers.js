const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("./models/User");

async function seedUsers() {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("Connected to MongoDB");

    const adminPassword = await bcrypt.hash(
      "admin123",
      10
    );

    const staffPassword = await bcrypt.hash(
      "staff123",
      10
    );

    await User.deleteMany({
      role: {
        $in: ["admin", "staff"]
      }
    });

    await User.create([
      {
        username: "admin",
        password: adminPassword,
        role: "admin",
        name: "System Administrator"
      },

      {
        username: "staff",
        password: staffPassword,
        role: "staff",
        name: "Library Staff"
      }
    ]);

    console.log("Admin and Staff accounts created!");

    console.log("");
    console.log("ADMIN");
    console.log("Username: admin");
    console.log("Password: admin123");

    console.log("");

    console.log("STAFF");
    console.log("Username: staff");
    console.log("Password: staff123");

  } catch (error) {
    console.error("ERROR:");
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

seedUsers();