const express = require("express");
const multer = require("multer");
const { getGridFSBucket,mongoose } = require("../config/db"); // Import from db.js
const authMiddleware = require("../middleware/authMiddleware"); // Adjust path as needed

const router = express.Router();
const csv = require("csv-parser");
const stream = require("stream");
// Multer setup with memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// File upload route
router.get("/json/:filename", authMiddleware, async (req, res) => {
    try {
      const gridfsBucket = getGridFSBucket();
      const file = await gridfsBucket.find({ filename: req.params.filename }).toArray();
  
      if (!file || file.length === 0) {
        return res.status(404).json({ message: "File not found" });
      }
  
      const downloadStream = gridfsBucket.openDownloadStreamByName(req.params.filename);
      const csvData = [];
  
      downloadStream
        .pipe(csv())
        .on("data", (row) => {
          csvData.push(row);
        })
        .on("end", () => {
          res.json(csvData);
        })
        .on("error", (error) => {
          res.status(500).json({ error: error.message });
        });
  
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get("/files/meta", authMiddleware, async (req, res) => {
    try {
      const gridfsBucket = getGridFSBucket();
      const files = await gridfsBucket.find({ "metadata.userId": req.user.id }).toArray();
  
      if (!files || files.length === 0) {
        return res.status(404).json({ message: "No files found" });
      }
  
      const fileMetadata = files.map((file) => ({
        filename: file.filename,
        uploadDate: file.uploadDate,
        metadata: file.metadata,
      }));
  
      res.json(fileMetadata);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

router.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
  
      const gridfsBucket = getGridFSBucket();
  
      // Check if file with the same name already exists
      const existingFile = await gridfsBucket.find({ filename: req.file.originalname }).toArray();
      
      if (existingFile.length > 0) {
        return res.status(400).json({ message: "File already exists" });
      }
  
      // Extract metadata (You can modify this part based on your specific requirements)
      const quarter = req.file.originalname.split('_')[1]; // Example: Q1
      const year = req.file.originalname.split('_')[2]; // Example: 2024
      const userId = req.user.id // Unique file ID for storage
  
      const fileInfo = {
        filename: req.file.originalname,
        bucketName: "filesBucket",
        metadata: {
          quarter: quarter,  // Quarter name like Q1, Q2, etc.
          year: year,        // Year of the data (e.g., 2024)
          userId: userId,    // Unique file ID generated here
          timestamp: new Date(),
        },
      };
  
      // Upload the file with metadata
      const uploadStream = gridfsBucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
        metadata: fileInfo.metadata,
      });
  
      uploadStream.end(req.file.buffer);
  
      uploadStream.on("finish", () => {
        res.status(201).json({
          message: "File uploaded successfully",
          fileId: uploadStream.id,
          filename: req.file.originalname,
          metadata: fileInfo.metadata, // Respond with metadata
        });
      });
  
      uploadStream.on("error", (error) => {
        res.status(500).json({ message: "Error uploading file", error: error.message });
      });
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  });

// Get file info by filename
router.get("/:filename", authMiddleware, async (req, res) => {
  try {
    const gridfsBucket = getGridFSBucket();
    const file = await gridfsBucket.find({ filename: req.params.filename }).toArray();

    if (!file || file.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    res.json(file[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File download route
router.get("/download/:filename", authMiddleware, async (req, res) => {
  try {
    const gridfsBucket = getGridFSBucket();
    const file = await gridfsBucket.find({ filename: req.params.filename }).toArray();

    if (!file || file.length === 0) {
      return res.status(404).json({ message: "File not found" });
    }

    const downloadStream = gridfsBucket.openDownloadStreamByName(req.params.filename);
    res.set("Content-Type", file[0].contentType || "application/octet-stream");
    downloadStream.pipe(res);

    downloadStream.on("error", (error) => {
      res.status(500).json({ error: error.message });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete("/:filename", authMiddleware, async (req, res) => {
    try {
      const gridfsBucket = getGridFSBucket(); // Get GridFSBucket instance
  
      // Find the file by filename
      const file = await gridfsBucket.find({ filename: req.params.filename }).toArray();
      if (!file.length) {
        return res.status(404).json({ message: "File not found" });
      }
  
      // Delete file by its _id (GridFS will remove both metadata and chunks)
      await gridfsBucket.delete(file[0]._id);
  
      res.json({ message: "File deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Error deleting file", error: error.message });
    }
  });

module.exports = router;
