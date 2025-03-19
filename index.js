const express = require("express");
require("dotenv").config();
const { connectDB } = require("./config/db"); // Import from db.js
const cors = require("cors");
const userRoutes = require("./routes/userRoutes");
const fileRoutes = require("./routes/fileRoutes");
const fastApiRoutes=require("./routes/fastApiRoutes")
const analyticsRoutes=require("./routes/analytics")
const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Server initialization
async function initializeServer() {
  try {
    await connectDB(); // Wait for DB and GridFS to be ready
    console.log("GridFS Bucket initialized");

    // Routes
    app.use("/user", userRoutes);
    app.use("/file", fileRoutes);
    app.use("/api",fastApiRoutes);
    app.use('/analytics',analyticsRoutes);
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Server initialization failed:", error);
    process.exit(1);
  }
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something went wrong!" });
});

// Start the server
initializeServer();