const express = require("express");
const multer = require("multer");
const csvParser = require("csv-parser");
const { Readable } = require("stream");
const axios = require("axios");
const { getGridFSBucket } = require("../config/db");

const Forecast = require("../schema/forecast"); // Import the forecast schema
const authMiddleware=require('../middleware/authMiddleware')
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }); // Store file in memory
router.post("/upload", authMiddleware ,upload.single("file"), async (req, res) => {
    const { year, quarter } = req.body; // Get year, quarter, and userId from request
    const userId=req.user.id
    if (!req.file) {
        return res.status(400).json({ error: "No file provided" });
    }

    try {
        // 🔹 Check if the forecast already exists
        const existingForecast = await Forecast.findOne({ year, quarter, userId });

        if (existingForecast) {
            return res.status(200).json({ message: "Forecast already exists", forecast: existingForecast });
        }

        // 🔹 Process CSV file
        let results = [];
        const stream = Readable.from(req.file.buffer.toString().split("\n"));

        stream
            .pipe(csvParser())
            .on("data", (row) => results.push(row))
            .on("end", async () => {
                results.sort((a, b) => a.sku.localeCompare(b.sku) || b.year - a.year || b.quarter - a.quarter);

                const latestEntries = [];
                const seenSKUs = new Set();

                for (let row of results) {
                    if (!seenSKUs.has(row.sku)) {
                        latestEntries.push(row);
                        seenSKUs.add(row.sku);
                    }
                }

                try {
                    // 🔹 Call prediction API
                    const predictionResponse = await axios.post("http://localhost:8000/predict", latestEntries, {
                        headers: { "Content-Type": "application/json" }
                    });

                    const predictedSales = predictionResponse.data.predicted_sales;

                    const finalResponse = latestEntries.map((entry, index) => ({
                        sku: entry.sku,
                        predicted_sales: predictedSales[index] || null
                    }));

                    // 🔹 Save new forecast in MongoDB
                    const newForecast = new Forecast({
                        year,
                        quarter,
                        userId,
                        predictions: finalResponse
                    });

                    await newForecast.save();

                    res.status(201).json({ message: "Forecast saved", forecast: newForecast });
                } catch (error) {
                    console.error("Error calling /predict:", error);
                    res.status(500).json({ error: "Failed to fetch predictions" });
                }
            });
    } catch (error) {
        console.error("Error processing forecast:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


router.get("/check-forecast", authMiddleware, async (req, res) => {
    try {
        const { year, quarter } = req.query;
        const userId = req.user.id;

        if (!year || !quarter || !userId) {
            return res.status(400).json({ error: "Year, quarter, and userId are required" });
        }

        const forecast = await Forecast.findOne({ year, quarter, userId });

        if (!forecast) {
            return res.json({ message: "Forecast not found" });
        }

        // Structuring the response in the format frontend needs
        const responseData = {
            year: forecast.year,
            quarter: forecast.quarter,
            userId: forecast.userId,
            predictions: forecast.predictions.map(item => ({
                sku: item.sku,
                predicted_sales: item.predicted_sales
            }))
        };

        return res.json(responseData);

    } catch (error) {
        console.error("Error checking forecast:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


router.post("/upload-from-gridfs", authMiddleware, async (req, res) => {
    const { year, quarter, fileName } = req.body;
    const userId = req.user.id;

    try {
        // 🔹 Check if the forecast already exists
        const existingForecast = await Forecast.findOne({ year, quarter, userId });

        if (existingForecast) {
            return res.status(200).json({ message: "Forecast already exists" });
        }

        const gridfsBucket = getGridFSBucket();
        
        // 🔹 Find the file in GridFS with metadata.userId filter
        const files = await gridfsBucket.find({ filename: fileName, "metadata.userId": userId }).toArray();
        if (!files.length) {
            return res.status(404).json({ error: "File not found or access denied" });
        }

        const results = [];
        const readStream = gridfsBucket.openDownloadStream(files[0]._id);

        readStream
            .pipe(csvParser())
            .on("data", (row) => results.push(row))
            .on("end", async () => {
                results.sort((a, b) => a.sku.localeCompare(b.sku) || b.year - a.year || b.quarter - a.quarter);

                const latestEntries = [];
                const seenSKUs = new Set();

                for (let row of results) {
                    if (!seenSKUs.has(row.sku)) {
                        latestEntries.push(row);
                        seenSKUs.add(row.sku);
                    }
                }

                try {
                    // 🔹 Call prediction API
                    const predictionResponse = await axios.post("http://localhost:8000/predict", latestEntries, {
                        headers: { "Content-Type": "application/json" }
                    });

                    const predictedSales = predictionResponse.data.predicted_sales;

                    const finalResponse = latestEntries.map((entry, index) => ({
                        sku: entry.sku,
                        predicted_sales: predictedSales[index] || null
                    }));

                    // 🔹 Save new forecast in MongoDB
                    const newForecast = new Forecast({
                        year,
                        quarter,
                        userId,
                        predictions: finalResponse
                    });

                    await newForecast.save();

                    res.status(201).json({ message: "Forecast saved" });
                } catch (error) {
                    console.error("Error calling /predict:", error);
                    res.status(500).json({ error: "Failed to fetch predictions" });
                }
            });
    } catch (error) {
        console.error("Error processing forecast:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});


module.exports = router;
