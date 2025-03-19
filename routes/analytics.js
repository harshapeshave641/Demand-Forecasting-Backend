const express = require("express");
const router = express.Router();
const Analytics = require("../schema/Analytics"); // Import the Analytics model
const authMiddleware = require("../middleware/authMiddleware");

// GET analytics for a specific quarter and year
router.get("/:year/:quarter",authMiddleware, async (req, res) => {
    try {
        const { year, quarter } = req.params;
        // Find the analytics data for the given quarter and year
        const analyticsData = await Analytics.findOne({
            quarter: `${year}_${quarter}`,
            userId:req.user.id
        });

        if (!analyticsData) {
            return res.status(404).json({ message: "No analytics data found for the given quarter and year" });
        }

        res.json(analyticsData);
    } catch (error) {
        console.error("Error fetching analytics data:", error);
        res.status(500).json({ error: "Internal server error" });
    }
});

module.exports = router;
