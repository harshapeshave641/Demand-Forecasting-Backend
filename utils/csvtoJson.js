const csv = require("csv-parser");
const { getGridFSBucket } = require("../config/db"); // Adjust path as needed

const getJSONFromGridFS = async (filename) => {
  try {
    const gridfsBucket = getGridFSBucket();
    const file = await gridfsBucket.find({ filename }).toArray();

    if (!file || file.length === 0) {
      throw new Error("File not found");
    }

    return new Promise((resolve, reject) => {
      const downloadStream = gridfsBucket.openDownloadStreamByName(filename);
      const csvData = [];

      downloadStream
        .pipe(csv()) // Parse CSV
        .on("data", (row) => {
          csvData.push(row);
        })
        .on("end", () => {
          resolve(csvData);
        })
        .on("error", (error) => {
          reject(error);
        });
    });

  } catch (error) {
    throw new Error(error.message);
  }
};

module.exports = { getJSONFromGridFS };
