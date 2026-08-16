const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");

const router = express.Router();

router.get("/test", (req, res) => {
  res.json({
    message: "Auth route is working"
  });
});


// ================================
// ADMIN / STAFF LOGIN
// ================================

router.post("/login", async (req, res) => {
  try {
    console.log("========== LOGIN REQUEST ==========");
    console.log("Body:", req.body);

    const { username, password } = req.body;

    if (!username || !password) {
      console.log("Missing username or password");

      return res.status(400).json({
        message: "Username and password are required"
      });
    }

    const cleanUsername = username.trim().toLowerCase();

    console.log("Searching for:", cleanUsername);

    const user = await User.findOne({
      username: cleanUsername
    });

    if (!user) {
      console.log("USER NOT FOUND");

      return res.status(401).json({
        message: "Invalid username or password"
      });
    }

    console.log("User found:");
    console.log({
      username: user.username,
      role: user.role,
      name: user.name
    });

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    console.log("Password match:", passwordMatch);

    if (!passwordMatch) {
      console.log("PASSWORD INCORRECT");

      return res.status(401).json({
        message: "Invalid username or password"
      });
    }

    if (
      user.role !== "admin" &&
      user.role !== "staff"
    ) {
      console.log("Invalid role:", user.role);

      return res.status(403).json({
        message: "Please use the Patron login"
      });
    }

    if (!process.env.JWT_SECRET) {
      console.log("JWT_SECRET IS MISSING");

      return res.status(500).json({
        message: "JWT_SECRET is not configured"
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    console.log("LOGIN SUCCESSFUL");

    res.json({
      message: "Login successful",

      token,

      user: {
        id: user._id,
        username: user.username,
        role: user.role,
        name: user.name
      }
    });

  } catch (error) {
    console.error("LOGIN ERROR:");
    console.error(error);

    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
});


// ================================
// PATRON LOGIN
// ================================

router.post("/patron-login", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase(),
      role: "patron"
    });

    if (!user) {
      return res.status(401).json({
        message: "Patron account not found"
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: "patron",
        name: user.name
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d"
      }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Server error"
    });
  }
});


// ================================
// GET ALL USERS (FROM MONGODB)
// ================================

router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching users" });
  }
});


module.exports = router;