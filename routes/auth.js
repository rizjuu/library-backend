const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { sendSignInNotificationEmail } = require("../utils/email");
const { protect } = require("../middleware/auth");

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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

    if (user.status === "disabled") {
      return res.status(403).json({
        message: "Your account has been disabled by administration. Please contact the library."
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
// PATRON GOOGLE OAUTH LOGIN
// ================================
router.post("/google-login", async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({
        message: "Google credential is required"
      });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({
        message: "Could not retrieve email from Google account"
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Find existing user by googleId or email
    let user = await User.findOne({
      $or: [
        { googleId: googleId },
        { email: cleanEmail, role: "patron" }
      ]
    });

    if (user) {
      if (user.status === "disabled") {
        return res.status(403).json({
          message: "Your patron account has been disabled by administration. Please contact the library."
        });
      }
      // Update googleId and avatar if not already set
      if (!user.googleId) user.googleId = googleId;
      if (picture && !user.avatar) user.avatar = picture;
      if (name && user.name === cleanEmail.split("@")[0]) user.name = name;
      await user.save();
      console.log(`[Google Auth] Found existing patron: ${cleanEmail}`);
    } else {

      // Create new patron
      user = await User.create({
        email: cleanEmail,
        googleId: googleId,
        avatar: picture || "",
        role: "patron",
        name: name || cleanEmail.split("@")[0]
      });
      console.log(`[Google Auth] Created new patron: ${cleanEmail}`);
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
      { expiresIn: "7d" }
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
        name: user.name,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error("GOOGLE LOGIN ERROR:", error);
    res.status(500).json({
      message: "Google authentication failed",
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
      if (user.status === "disabled") {
        return res.status(403).json({
          message: "Your patron account has been disabled by administration. Please contact the library."
        });
      }
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
        name: req.user.name,
        phone: req.user.phone,
        avatar: req.user.avatar,
        status: req.user.status
      }
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching user profile" });
  }
});

// ================================
// UPDATE CURRENT USER PROFILE
// ================================
router.patch("/me", protect, async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }
    if (email !== undefined && (!email.trim() || !email.includes("@"))) {
      return res.status(400).json({ message: "A valid email address is required" });
    }

    const user = req.user;
    const cleanEmail = email === undefined ? user.email : email.trim().toLowerCase();
    if (cleanEmail && cleanEmail !== user.email) {
      const existingUser = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
      if (existingUser) return res.status(409).json({ message: "That email address is already in use" });
    }

    user.name = name.trim();
    user.email = cleanEmail;
    if (phone !== undefined) user.phone = phone.trim();
    await user.save();

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        name: user.name,
        phone: user.phone,
        avatar: user.avatar,
        status: user.status
      }
    });
  } catch (error) {
    console.error("Error updating current user profile:", error);
    res.status(500).json({ message: "Failed to update profile" });
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