const csv = require("csv-parser");
const { stringify } = require("csv-stringify/sync");
const { getGridFSBucket } = require("../config/db");

const getPreviousQuarters = (currentYear, currentQuarter) => {
    const quarters = [];
    
    // Start from the quarter before the current one
    currentQuarter--;

    // Handle the case where the previous quarter is Q4 of the last year
    if (currentQuarter === 0) {
        currentQuarter = 4;
        currentYear--;
    }

    // Get 4 previous quarters
    for (let i = 0; i < 4; i++) {
        quarters.push({ year: currentYear, quarter: `Q${currentQuarter}` });
        currentQuarter--;
        if (currentQuarter === 0) {
            currentQuarter = 4;
            currentYear--;
        }
    }

    return quarters;
};


// 📌 Function to merge CSV files for a user
const mergeUserCSVFiles = async (userId) => {
    try {
        const gridfsBucket = getGridFSBucket();

        // Get current year and quarter
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        const currentQuarter = Math.ceil(currentMonth / 3);
        console.log(currentYear,currentQuarter)
        // Get last 4 quarters
        const lastFourQuarters = getPreviousQuarters(currentYear, currentQuarter);
        console.log("🔍 Previous 4 quarters:", lastFourQuarters); // Debugging log
        // 🔍 Query for files in GridFS
        const fileQuery = {
            "metadata.userId": userId,
            $or: lastFourQuarters.map(q => ({
                "metadata.year": String(q.year),
                "metadata.quarter": q.quarter
            }))
        };
        

        const files = await gridfsBucket.find(fileQuery).sort({ "metadata.year": -1, "metadata.quarter": -1 }).toArray();

        if (!files.length) {
            return { success: false, message: "No CSV files found for merging." };
        }

        let allData = [];
        let headers = null;

        // 🛠 Function to process each file
        const processFile = async (file) => {
            return new Promise((resolve, reject) => {
                const stream = gridfsBucket.openDownloadStream(file._id);
                const fileData = [];
                
                stream.pipe(csv())
                    .on("headers", (h) => {
                        if (!headers) headers = h; // Store headers from the first file
                    })
                    .on("data", (row) => {
                        fileData.push(row);
                    })
                    .on("end", () => resolve(fileData))
                    .on("error", (err) => reject(err));
            });
        };

        // 🔄 Process all CSV files asynchronously
        for (const file of files) {
            const fileData = await processFile(file);
            allData.push(...fileData);
        }

        // 📝 Convert merged JSON to CSV format
        const mergedCSV = stringify(allData, { header: true, columns: headers });

        return { success: true, csvData: mergedCSV };

    } catch (error) {
        console.error("Error merging CSVs:", error);
        return { success: false, message: "Server error", error: error.message };
    }
};

module.exports = { mergeUserCSVFiles };
