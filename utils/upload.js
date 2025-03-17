const multer = require("multer");
const { GridFsStorage } = require("multer-gridfs-storage");
const { mongoose } = require("../config/db");

let uploadInstance;

mongoose.connection.once("open", () => {
  console.log("MongoDB connection open, initializing GridFsStorage...");
  const storage = new GridFsStorage({
    db: mongoose.connection,
    file: (req, file) => {
      return new Promise((resolve) => {
        console.log(`Preparing file: ${file.originalname}`);
        
        const quarter = file.originalname.split('_')[1]; 
        const year = file.originalname.split('_')[2]; 
        const fileId = new mongoose.Types.ObjectId(); 

        const fileInfo = {
          filename: file.originalname,
          bucketName: "filesBucket",
          metadata: {
            quarter: quarter,  
            year: year,       
            fileId: fileId,   
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

module.exports = {
  get upload() {
    if (!uploadInstance) {
      throw new Error("Upload middleware not initialized yet. Wait for MongoDB connection.");
    }
    return uploadInstance;
  },
};
