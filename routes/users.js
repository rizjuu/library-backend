const express = require("express");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { protect, authorize } = require("../middleware/auth");

const router = express.Router();

// Apply auth middleware to all user management routes
router.use(protect);

// GET /api/users - List & Search Patrons / Users (admin + staff can view)
router.get("/", authorize("admin", "staff"), async (req, res) => {
  try {
    const { search, role, status } = req.query;
    const query = {};

    if (role) {
      query.role = role;
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      const searchRegex = new RegExp(search.trim(), "i");
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { username: searchRegex }
      ];
    }

    const users = await User.find(query).select("-password").sort({ createdAt: -1 });

    // Fetch active loan counts for each patron
    const usersWithStats = await Promise.all(
      users.map(async (u) => {
        const uObj = u.toObject();
        if (u.role === "patron") {
          const activeLoans = await Transaction.countDocuments({
            $or: [
              { borrowerEmail: u.email },
              { borrowerName: new RegExp(`^${u.name}$`, "i") }
            ],
            returned: false
          });
          const totalLoans = await Transaction.countDocuments({
            $or: [
              { borrowerEmail: u.email },
              { borrowerName: new RegExp(`^${u.name}$`, "i") }
            ]
          });
          uObj.activeLoans = activeLoans;
          uObj.totalLoans = totalLoans;
        } else {
          uObj.activeLoans = 0;
          uObj.totalLoans = 0;
        }
        return uObj;
      })
    );

    res.json(usersWithStats);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ message: "Failed to fetch users", error: error.message });
  }
});

// All routes below this line are Admin Only
router.use(authorize("admin"));

// POST /api/users/patron - Admin Add New Patron
router.post("/patron", async (req, res) => {
  try {
    const { name, email, phone, status } = req.body;

    if (!name || !email || !email.includes("@")) {
      return res.status(400).json({ message: "Name and a valid Email address are required" });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: cleanEmail });

    if (existingUser) {
      return res.status(400).json({ message: `A user with email ${cleanEmail} already exists` });
    }

    const patron = await User.create({
      name: name.trim(),
      email: cleanEmail,
      phone: (phone || "").trim(),
      role: "patron",
      status: status === "disabled" ? "disabled" : "active"
    });

    res.status(201).json({
      message: "Patron created successfully",
      patron: {
        id: patron._id,
        _id: patron._id,
        name: patron.name,
        email: patron.email,
        phone: patron.phone,
        role: patron.role,
        status: patron.status,
        createdAt: patron.createdAt
      }
    });
  } catch (error) {
    console.error("Error creating patron:", error);
    res.status(500).json({ message: "Failed to create patron", error: error.message });
  }
});

// GET /api/users/:id - Get Single User / Patron Details
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({ message: "Failed to fetch user details" });
  }
});

// PUT /api/users/:id - Update User / Patron Details
router.put("/:id", async (req, res) => {
  try {
    const { name, email, phone, status, role } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name) user.name = name.trim();
    if (email) user.email = email.trim().toLowerCase();
    if (phone !== undefined) user.phone = phone.trim();
    if (status && ["active", "disabled"].includes(status)) user.status = status;
    if (role && ["admin", "staff", "patron"].includes(role)) user.role = role;

    await user.save();

    res.json({
      message: "User updated successfully",
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status
      }
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Failed to update user", error: error.message });
  }
});

// PATCH /api/users/:id/status - Enable / Disable Patron Status
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body;

    if (!["active", "disabled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Must be 'active' or 'disabled'" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.status = status;
    await user.save();

    res.json({
      message: `User status changed to ${status}`,
      user: {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        status: user.status
      }
    });
  } catch (error) {
    console.error("Error toggling user status:", error);
    res.status(500).json({ message: "Failed to change user status", error: error.message });
  }
});

// GET /api/users/:id/history - Get Borrowing History for a Patron
router.get("/:id/history", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const history = await Transaction.find({
      $or: [
        { borrowerEmail: user.email },
        { borrowerName: new RegExp(`^${user.name}$`, "i") }
      ]
    })
      .populate("bookId", "title barcode category author shelf")
      .sort({ createdAt: -1 });

    res.json({
      patron: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        status: user.status
      },
      history
    });
  } catch (error) {
    console.error("Error fetching patron borrowing history:", error);
    res.status(500).json({ message: "Failed to fetch borrowing history", error: error.message });
  }
});

module.exports = router;
