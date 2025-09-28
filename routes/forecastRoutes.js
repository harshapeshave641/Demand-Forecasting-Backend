const express = require("express");
const multer = require("multer");
const csvParser = require("csv-parser");
const { Readable } = require("stream");
const axios = require("axios");
const Forecast = require("../schema/forecast");
const { getGridFSBucket } = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // Store file in memory

const N = 4; // Last N quarters

// Helper: group rows by distributor+SKU and keep last N quarters
function getLastNQuarters(rows) {
    const grouped = {};
    rows.forEach(row => {
        const key = `${row.distributor_id}-${row.sku}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(row);
    });

    Object.keys(grouped).forEach(key => {
        grouped[key].sort((a, b) => a.year - b.year || a.quarter - b.quarter);
        grouped[key] = grouped[key].slice(-N);
    });

    return grouped;
}

// Upload CSV and predict
router.post("/upload", authMiddleware, upload.single("file"), async (req, res) => {
    const { year, quarter } = req.body;
    const userId = req.user.id;

    if (!req.file) return res.status(400).json({ error: "No file provided" });

    try {
        // Check if forecast already exists
        const existingForecast = await Forecast.findOne({ year, quarter, userId });
        if (existingForecast) {
            return res.status(200).json({ message: "Forecast already exists", forecast: existingForecast });
        }

        // Parse CSV
        let rows = [];
        const stream = Readable.from(req.file.buffer.toString().split("\n"));
        stream
            .pipe(csvParser())
            .on("data", row => rows.push(row))
            .on("end", async () => {
                // Keep last N quarters
                const lastNGrouped = getLastNQuarters(rows);

                // Prepare payload for FastAPI
                const payload = Object.keys(lastNGrouped).map(key => {
                    const [distributor_id, sku] = key.split("-");
                    return { distributor_id, sku, last_n_quarters: lastNGrouped[key] };
                });

                try {
                    // Call FastAPI LSTM
                    const predictionResponse = await axios.post("http://localhost:8000/predict", payload, {
                        headers: { "Content-Type": "application/json" }
                    });

                    const predictedSales = predictionResponse.data;

                    // Map predictions back
                    const finalResponse = predictedSales.map(item => ({
                        sku: item.sku,
                        predicted_sales: item.predicted_sales
                    }));

                    // Save forecast in MongoDB
                    const newForecast = new Forecast({ year, quarter, userId, predictions: finalResponse });
                    await newForecast.save();

                    res.status(201).json({ message: "Forecast saved", forecast: newForecast });
                } catch (err) {
                    console.error("Error calling FastAPI /predict:", err.response?.data || err.message);
                    res.status(500).json({ error: "Failed to fetch predictions" });
                }
            });
    } catch (error) {
        console.error("Error processing forecast:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Check forecast
router.get("/check-forecast", authMiddleware, async (req, res) => {
    try {
        const { year, quarter } = req.query;
        const userId = req.user.id;
        if (!year || !quarter || !userId) return res.status(400).json({ error: "Year, quarter, and userId are required" });

        const forecast = await Forecast.findOne({ year, quarter, userId });
        if (!forecast) return res.json({ message: "Forecast not found" });

        res.json({
            year: forecast.year,
            quarter: forecast.quarter,
            userId: forecast.userId,
            predictions: forecast.predictions.map(p => ({ sku: p.sku, predicted_sales: p.predicted_sales }))
        });
    } catch (error) {
        console.error("Error checking forecast:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Upload from GridFS
router.post("/upload-from-gridfs", authMiddleware, async (req, res) => {
    const { year, quarter, fileName } = req.body;
    const userId = req.user.id;

    try {
        const existingForecast = await Forecast.findOne({ year, quarter, userId });
        if (existingForecast) return res.status(200).json({ message: "Forecast already exists" });

        const gridfsBucket = getGridFSBucket();
        const files = await gridfsBucket.find({ filename: fileName, "metadata.userId": userId }).toArray();
        if (!files.length) return res.status(404).json({ error: "File not found or access denied" });

        const rows = [];
        const readStream = gridfsBucket.openDownloadStream(files[0]._id);

        readStream
            .pipe(csvParser())
            .on("data", row => rows.push(row))
            .on("end", async () => {
                const lastNGrouped = getLastNQuarters(rows);

                const payload = Object.keys(lastNGrouped).map(key => {
                    const [distributor_id, sku] = key.split("-");
                    return { distributor_id, sku, last_n_quarters: lastNGrouped[key] };
                });

                try {
                    const predictionResponse = await axios.post("http://localhost:8000/predict", payload, {
                        headers: { "Content-Type": "application/json" }
                    });

                    const predictedSales = predictionResponse.data;

                    const finalResponse = predictedSales.map(item => ({
                        sku: item.sku,
                        predicted_sales: item.predicted_sales
                    }));

                    const newForecast = new Forecast({ year, quarter, userId, predictions: finalResponse });
                    await newForecast.save();

                    res.status(201).json({ message: "Forecast saved" });
                } catch (err) {
                    console.error("Error calling FastAPI /predict:", err.response?.data || err.message);
                    res.status(500).json({ error: "Failed to fetch predictions" });
                }
            });
    } catch (error) {
        console.error("Error processing GridFS forecast:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

module.exports = router;
