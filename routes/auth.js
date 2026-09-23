const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { sendSignInNotificationEmail, sendPasswordResetEmail } = require("../utils/email");
const { protect } = require("../middleware/auth");

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

router.get("/test", (req, res) => {
  res.json({
    message: "Auth route is working"
  });
});

// ================================
// UNIFIED LOGIN (Admin, Staff, or Patron)
// ================================
router.post("/login", async (req, res) => {
  try {
    console.log("========== LOGIN REQUEST ==========");
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        message: "Username/email and password are required"
      });
    }

    const cleanIdentifier = username.trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { username: cleanIdentifier },
        { email: cleanIdentifier }
      ]
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

    if (!user.password) {
      return res.status(401).json({
        message: "No password set for this account. Please use Google sign-in or contact the administrator."
      });
    }

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({
        message: "Invalid username or password"
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
        email: user.email,
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
        email: user.email,
        role: user.role,
        name: user.name,
        avatar: user.avatar
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
// FORGOT PASSWORD - REQUEST RESET CODE
// ================================
router.post("/forgot-password", async (req, res) => {
  try {
    const { identifier } = req.body;

    if (!identifier || !identifier.trim()) {
      return res.status(400).json({
        message: "Please enter your username or registered email address"
      });
    }

    const clean = identifier.trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { username: clean },
        { email: clean }
      ]
    });

    if (!user) {
      return res.status(404).json({
        message: "No account found matching that username or email address"
      });
    }

    if (user.status === "disabled") {
      return res.status(403).json({
        message: "This account has been disabled. Please contact library administration."
      });
    }

    // Generate 6-digit verification code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordCode = resetCode;
    user.resetPasswordExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    await user.save();

    // If user has an email address, send it
    if (user.email && user.email.includes("@")) {
      await sendPasswordResetEmail(user.email, user.name, resetCode);
      const maskedEmail = user.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${"*".repeat(Math.max(1, b.length - 1))}${b.slice(-1)}${c}`);

      return res.json({
        message: `A 6-digit verification code has been sent to ${maskedEmail}`,
        emailSent: true,
        maskedEmail
      });
    } else {
      console.log(`[Forgot Password] User ${user.username} has no email. Reset code: ${resetCode}`);
      return res.json({
        message: "A verification code has been generated for your account.",
        emailSent: false,
        devCode: resetCode
      });
    }
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);
    res.status(500).json({
      message: "An error occurred while processing your request",
      error: error.message
    });
  }
});

// ================================
// RESET PASSWORD - VERIFY & UPDATE
// ================================
router.post("/reset-password", async (req, res) => {
  try {
    const { identifier, code, newPassword } = req.body;

    if (!identifier || !code || !newPassword) {
      return res.status(400).json({
        message: "Username/email, verification code, and new password are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters long"
      });
    }

    const clean = identifier.trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { username: clean },
        { email: clean }
      ]
    });

    if (!user) {
      return res.status(404).json({
        message: "No account found matching that username or email address"
      });
    }

    if (!user.resetPasswordCode || !user.resetPasswordExpires) {
      return res.status(400).json({
        message: "No password reset code requested for this account"
      });
    }

    if (new Date() > new Date(user.resetPasswordExpires)) {
      return res.status(400).json({
        message: "The verification code has expired. Please request a new one."
      });
    }

    if (user.resetPasswordCode.trim() !== String(code).trim()) {
      return res.status(400).json({
        message: "Invalid verification code. Please check and try again."
      });
    }

    // Hash new password and clear reset fields
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetPasswordCode = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      message: "Your password has been successfully reset! You can now log in."
    });
  } catch (error) {
    console.error("RESET PASSWORD ERROR:", error);
    res.status(500).json({
      message: "Failed to reset password",
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
// GET CURRENT USER PROFILE (/me)
// ================================
router.get("/me", protect, async (req, res) => {
  try {
    const user = req.user;
    let firstName = user.firstName || "";
    let lastName = user.lastName || "";
    if (!firstName && !lastName && user.name) {
      const parts = user.name.trim().split(/\s+/);
      firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0];
      lastName = parts.length > 1 ? parts[parts.length - 1] : "";
    }

    res.json({
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        name: user.name,
        firstName,
        lastName,
        phone: user.phone,
        avatar: user.avatar,
        status: user.status
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
    let { name, firstName, lastName, email, phone } = req.body;

    if (!name && (firstName || lastName)) {
      name = `${firstName || ""} ${lastName || ""}`.trim();
    } else if (name && (!firstName && !lastName)) {
      const parts = name.trim().split(/\s+/);
      firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0];
      lastName = parts.length > 1 ? parts[parts.length - 1] : "";
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "First name and last name are required" });
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
    if (firstName !== undefined) user.firstName = String(firstName).trim();
    if (lastName !== undefined) user.lastName = String(lastName).trim();
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
        firstName: user.firstName || (user.name.split(/\s+/).length > 1 ? user.name.split(/\s+/).slice(0, -1).join(" ") : user.name),
        lastName: user.lastName || (user.name.split(/\s+/).length > 1 ? user.name.split(/\s+/).pop() : ""),
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