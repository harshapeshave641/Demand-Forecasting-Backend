const express = require("express");
const multer = require("multer");
const { getGridFSBucket,mongoose } = require("../config/db"); 
const authMiddleware = require("../middleware/authMiddleware"); 
const { mergeUserCSVFiles } = require("../utils/csvUtils"); 
const {getJSONFromGridFS}=require("../utils/csvtoJson")
const router = express.Router();
const csv = require("csv-parser");
const stream = require("stream");
const storage = multer.memoryStorage();
const upload = multer({ storage });
const Analytics=require('../schema/Analytics')
const {performAnalytics}=require("../utils/analytics")

router.get("/merge", authMiddleware, async (req, res) => {
  // console.log("hello")
  const userId = req.user.id;
  
  const result = await mergeUserCSVFiles(userId);
  // console.log(result)
  if (!result.success) {
      return res.status(404).json({ message: result.message });
  }

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", 'attachment; filename="merged_data.csv"');
  res.send(result.csvData);
});


// File upload route
router.get("/json/:filename", authMiddleware, async (req, res) => {
  try {
    const jsonData = await getJSONFromGridFS(req.params.filename);
    res.json(jsonData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post("/perform/:filename", authMiddleware, async (req, res) => {
  try {
    const jsonData = await getJSONFromGridFS(req.params.filename);
    const analyticsResult = performAnalytics(jsonData);
    console.log(analyticsResult)
    try {
      for (const key in analyticsResult) {
        const [year, quarter] = key.split('_'); // Correct order
        const analyticsDoc = new Analytics({
          userId:req.user.Id,
          quarter: parseInt(quarter.replace('Q', '')), // Extracts 3 from 'Q3'
          year: parseInt(year), // Extracts 2024
          ...analyticsResult[key]
        });
        await analyticsDoc.save();
      }
      
      res.json({message:"Success"})
      console.log("Analytics saved successfully!");
    } catch (error) {
      console.error("Error saving analytics:", error);
    }
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
      const existingFile = await gridfsBucket.find({
        filename: req.file.originalname,
        "metadata.userId": req.user.id // Assuming `req.user.id` contains the user's ID
      }).toArray();
      
      if (existingFile.length > 0) {
          return res.status(400).json({ message: "File already exists" });
      }

      // Extract metadata from filename (Example: Q1_2024_Q3_2025)
      const filenameParts = req.file.originalname.split('_');
      
      if (filenameParts.length < 4) {
          return res.status(400).json({ message: "Invalid filename format" });
      }

      const startQuarter = filenameParts[0]; // Q1
      const startYear = parseInt(filenameParts[1]); // 2024
      const endQuarter = filenameParts[2]; // Q3
      const endYear = parseInt(filenameParts[3].split('.')[0]); // 2025
      const userId = req.user.id; // User ID

      // Convert quarter names to numeric values for calculation
      const quarterMapping = { Q1: 1, Q2: 2, Q3: 3, Q4: 4 };
      const startQuarterNum = quarterMapping[startQuarter];
      const endQuarterNum = quarterMapping[endQuarter];

      // Calculate number of quarters in range
      const noOfQuarters = (endYear - startYear) * 4 + (endQuarterNum - startQuarterNum) + 1;

      const fileInfo = {
          filename: req.file.originalname,
          bucketName: "filesBucket",
          metadata: {
              startQuarter: startQuarter,
              startYear: startYear,
              endQuarter: endQuarter,
              endYear: endYear,
              noOfQuarters: noOfQuarters,
              userId: userId,
              timestamp: new Date(),
          },
      };

      // Upload the file with metadata
      const uploadStream = gridfsBucket.openUploadStream(req.file.originalname, {
          contentType: req.file.mimetype,
          metadata: fileInfo.metadata,
      });

      uploadStream.end(req.file.buffer);

      uploadStream.on("finish", async () => {
          try {
              // After file upload is complete, perform analytics
              const jsonData = await getJSONFromGridFS(req.file.originalname);
              const analyticsResult = performAnalytics(jsonData);
              console.log(analyticsResult);

              // Save analytics results to the database
              for (const key in analyticsResult) {
                  const [year, quarter] = key.split('_'); // Correct order
                  const analyticsDoc = new Analytics({
                      userId: req.user.id, // Use req.user.id instead of req.user.Id
                      quarter: parseInt(quarter.replace('Q', '')), // Extracts 3 from 'Q3'
                      year: parseInt(year), // Extracts 2024
                      ...analyticsResult[key]
                  });
                  await analyticsDoc.save();
              }

              console.log("Analytics saved successfully!");
              res.status(201).json({
                  message: "File uploaded and analytics performed successfully",
                  fileId: uploadStream.id,
                  filename: req.file.originalname,
                  metadata: fileInfo.metadata,
              });
          } catch (error) {
              console.error("Error performing analytics or saving results:", error);
              res.status(500).json({ message: "Error performing analytics", error: error.message });
          }
      });

      uploadStream.on("error", (error) => {
          res.status(500).json({ message: "Error uploading file", error: error.message });
      });
  } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Get file metadata by filename
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
router.get("/deliver/:filename", authMiddleware, async (req, res) => {
  try {
    const gridfsBucket = getGridFSBucket();
    
    // Log available filenames in GridFS
    const allFiles = await gridfsBucket.find({}).toArray();
    console.log("Available files:", allFiles.map(f => f.filename));

    const file = await gridfsBucket.find({ filename: req.params.filename }).toArray();
    
    if (!file || file.length === 0) {
      console.log(`❌ File not found: ${req.params.filename}`);
      return res.status(404).json({ message: "File not found" });
    }

    console.log(`✅ File found: ${req.params.filename}`);

    const downloadStream = gridfsBucket.openDownloadStreamByName(req.params.filename);
    res.set("Content-Type", "text/csv");

    downloadStream.pipe(res);

    downloadStream.on("error", (error) => {
      res.status(500).json({ error: error.message });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


router.delete("/:filename", async (req, res) => {
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
