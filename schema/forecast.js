const mongoose = require("mongoose");

const forecastSchema = new mongoose.Schema({
    year: { type: Number, required: true },
    quarter: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    predictions: [
        {
            sku: { type: String, required: true },
            predicted_sales: { type: Number, required: true }
        }
    ]
}, { timestamps: true });

module.exports = mongoose.model("Forecast", forecastSchema);
