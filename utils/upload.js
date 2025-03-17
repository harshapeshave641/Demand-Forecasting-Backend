const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const { mongoose } = require("../config/db");

let uploadInstance;

// Initialize upload middleware once the connection is ready
mongoose.connection.once("open", () => {
  console.log("MongoDB connection open, initializing GridFsStorage...");
  const storage = new GridFsStorage({
    db: mongoose.connection,
    file: (req, file) => {
      return new Promise((resolve) => {
        console.log(`Preparing file: ${file.originalname}`);
        
        // Extracting quarter and year from the file or other source (you can adapt this as per your requirements)
        const quarter = file.originalname.split('_')[1]; // Example: Q1
        const year = file.originalname.split('_')[2]; // Example: 2024
        const fileId = new mongoose.Types.ObjectId(); // Unique file ID for storage

        const fileInfo = {
          filename: file.originalname,
          bucketName: "filesBucket",
          metadata: {
            quarter: quarter,  // Quarter name like Q1, Q2, etc.
            year: year,        // Year of the data (e.g., 2024)
            fileId: fileId,    // Unique file ID generated here
            timestamp: new Date(),
          },
        };
        resolve(fileInfo);
      });
    },
  });

  storage.on("file", (file) => {
    console.log("File stored in GridFS:", file);
  });

  storage.on("error", (error) => {
    console.error("GridFsStorage error:", error);
  });

  uploadInstance = multer({ storage });
  console.log("GridFsStorage initialized");
});

// Export a getter to ensure uploadInstance is only accessed after initialization
module.exports = {
  get upload() {
    if (!uploadInstance) {
      throw new Error("Upload middleware not initialized yet. Wait for MongoDB connection.");
    }
    return uploadInstance;
  },
};
