const mongoose = require("mongoose");

const analyticsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Reference to User model
  quarter: { type: String, required: true }, // Q1, Q2, Q3, Q4
  year: { type: Number, required: true },
  totalSales: { type: Number, required: true },
  totalOrders: { type: Number, required: true },
  avgSalesPerOrder: { type: String, required: true },
  topSKUs: { type: Array, required: true },
  skuSales: { type: Object, required: true },
  categorySales: { type: Object, required: true },
  festivals: { type: [String], required: true },
  previousSales: { type: Object, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Analytics", analyticsSchema);
