const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendSignInNotificationEmail } = require("../utils/email");
const { protect } = require("../middleware/auth");

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
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username and password are required"
      });
    }

    const cleanUsername = username.trim().toLowerCase();
    const user = await User.findOne({
      username: cleanUsername
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid username or password"
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid username or password"
      });
    }

    if (user.role !== "admin" && user.role !== "staff") {
      return res.status(403).json({
        message: "Please use the Patron login option"
      });
    }

    if (!process.env.JWT_SECRET) {
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
      { expiresIn: "1d" }
    );

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
    console.error("LOGIN ERROR:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
});

// ================================
// PATRON DIRECT LOGIN (EMAIL AUTH + NOTIFICATION)
// ================================
router.post("/patron-login", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({
        message: "A valid email address is required"
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await User.findOne({
      email: cleanEmail,
      role: "patron"
    });

    if (!user) {
      // Automatically save new patron email to MongoDB database for future logins
      const defaultName = cleanEmail.split("@")[0];
      user = await User.create({
        email: cleanEmail,
        role: "patron",
        name: defaultName.charAt(0).toUpperCase() + defaultName.slice(1)
      });
      console.log(`[DB] Created and saved new patron record for email: ${cleanEmail}`);
    } else {
      console.log(`[DB] Found existing patron in MongoDB: ${cleanEmail}`);
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: "JWT_SECRET is not configured"
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
        expiresIn: "7d"
      }
    );

    // Send sign-in notification email asynchronously
    sendSignInNotificationEmail(user.email, user.name).catch((err) => {
      console.error("[Email Notification Warning]:", err.message);
    });

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
    console.error("PATRON LOGIN ERROR:", error);
    res.status(500).json({
      message: "Server error during patron login",
      error: error.message
    });
  }
});

// ================================
// GET CURRENT USER PROFILE (/me)
// ================================
router.get("/me", protect, async (req, res) => {
  try {
    res.json({
      user: {
        id: req.user._id,
        username: req.user.username,
        email: req.user.email,
        role: req.user.role,
        name: req.user.name
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching user profile" });
  }
});

// ================================
// GET ALL USERS (FROM MONGODB)
// ================================
router.get("/users", protect, async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching users" });
  }
});

module.exports = router;