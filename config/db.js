const mongoose = require("mongoose");
const { GridFSBucket } = require("mongodb");

let gridfsBucket;

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    gridfsBucket = new GridFSBucket(conn.connection.db, {
      bucketName: "filesBucket",
    });
    return gridfsBucket;
  } catch (err) {
    console.error("Database connection failed:", err.message);
    process.exit(1);
  }
};

const getGridFSBucket = () => {
  if (!gridfsBucket) {
    throw new Error("GridFSBucket not initialized yet");
  }
  return gridfsBucket;
};

module.exports = { connectDB, mongoose, getGridFSBucket };