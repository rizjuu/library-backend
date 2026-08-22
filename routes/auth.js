const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { sendMagicLinkEmail } = require("../utils/email");
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
// PATRON MAGIC LINK REQUEST (EMAIL AUTH)
// ================================
router.post("/patron-request-link", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({
        message: "A valid email address is required"
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Find patron or automatically save/create new patron record in database
    let patron = await User.findOne({
      email: cleanEmail,
      role: "patron"
    });

    if (!patron) {
      const defaultName = cleanEmail.split("@")[0];
      patron = await User.create({
        email: cleanEmail,
        role: "patron",
        name: defaultName.charAt(0).toUpperCase() + defaultName.slice(1)
      });
      console.log(`[DB] Created new patron record for email: ${cleanEmail}`);
    } else {
      console.log(`[DB] Found existing patron record for email: ${cleanEmail}`);
    }

    // Generate short-lived token for magic link (expires in 15 minutes)
    const magicToken = jwt.sign(
      {
        id: patron._id,
        email: patron.email,
        type: "magic_link"
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // Dynamically derive frontend URL from request origin/referer or FRONTEND_URL env var
    let requestOrigin = req.headers.origin;
    if (!requestOrigin && req.get("referer")) {
      try {
        requestOrigin = new URL(req.get("referer")).origin;
      } catch (e) {
        requestOrigin = null;
      }
    }

    const frontendBase = (requestOrigin || process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    const magicLink = `${frontendBase}/verify-patron?token=${magicToken}`;

    // Send email with magic link directly to patron inbox
    await sendMagicLinkEmail(patron.email, magicLink);

    res.json({
      message: `An email with a login link has been sent to ${patron.email}. Please check your email inbox to log in.`,
      email: patron.email
    });


  } catch (error) {
    console.error("PATRON MAGIC LINK REQUEST ERROR:", error);
    res.status(500).json({
      message: "Failed to process patron login link request",
      error: error.message
    });
  }
});

// ================================
// PATRON MAGIC LINK VERIFICATION
// ================================
router.get("/verify-patron-token", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        message: "Authentication token is missing"
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        message: "Authentication link is invalid or has expired. Please request a new link."
      });
    }

    if (decoded.type !== "magic_link") {
      return res.status(400).json({
        message: "Invalid token type"
      });
    }

    let patron = await User.findById(decoded.id);
    if (!patron) {
      patron = await User.findOne({ email: decoded.email, role: "patron" });
    }

    if (!patron) {
      // Create if missing
      patron = await User.create({
        email: decoded.email,
        role: "patron",
        name: decoded.email.split("@")[0]
      });
    }

    // Generate long-lived session token
    const sessionToken = jwt.sign(
      {
        id: patron._id,
        email: patron.email,
        role: "patron",
        name: patron.name
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Authentication successful",
      token: sessionToken,
      user: {
        id: patron._id,
        email: patron.email,
        role: patron.role,
        name: patron.name
      }
    });
  } catch (error) {
    console.error("PATRON VERIFY ERROR:", error);
    res.status(500).json({
      message: "Server error verifying magic link token",
      error: error.message
    });
  }
});

// ================================
// PATRON DIRECT LOGIN (EXISTING ROUTE RETAILED)
// ================================
router.post("/patron-login", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    let user = await User.findOne({
      email: cleanEmail,
      role: "patron"
    });

    if (!user) {
      // Save patron email to database automatically
      user = await User.create({
        email: cleanEmail,
        role: "patron",
        name: cleanEmail.split("@")[0]
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