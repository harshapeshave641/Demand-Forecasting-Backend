const express = require("express");
const axios = require("axios");

const router = express.Router();
const authMiddleware=require('../middleware/authMiddleware')
const FASTAPI_URL = process.env.FASTAPI_URL;

router.post("/predict", authMiddleware, async (req, res) => {
    try {
        const response = await axios.post(`${FASTAPI_URL}/predict`, req.body);

        res.json(response.data);
    } catch (error) {
        console.error("Error calling FastAPI:", error.message);
        res.status(500).json({ error: "Failed to fetch prediction from FastAPI" });
    }
});


module.exports = router;
