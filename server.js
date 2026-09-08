const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/books", require("./routes/books"));
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/external-books", require("./routes/externalBooks"));
app.use("/api/announcements", require("./routes/announcements"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/reports", require("./routes/reports"));

app.get("/", (req, res) => {
  res.send("Library API Running");
});

const PORT = process.env.PORT || 5000;

async function startServer() {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is not configured");
  }

  await mongoose.connect(process.env.MONGO_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000
  });

  console.log("MongoDB connected");
  app.listen(PORT, () => {
    console.log(`Server running on ${PORT}`);
  });
}

mongoose.connection.on("error", (error) => {
  console.error("MongoDB connection error:", error.message);
});

startServer().catch((error) => {
  console.error("MongoDB startup failed:", error.message);
  process.exit(1);
});