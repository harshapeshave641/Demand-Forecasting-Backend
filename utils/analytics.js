function performAnalytics(data) {
    const analytics = {};
    const quarterKeys = [...new Set(data.map(row => `${row.year}_Q${row.quarter}`))].sort();

    quarterKeys.forEach((key, index) => {
        const quarterData = data.filter(row => `${row.year}_Q${row.quarter}` === key);

        // Calculate total sales
        const totalSales = quarterData.reduce((sum, row) => sum + parseFloat(row.sales), 0);

        // SKU-wise total sales
        const skuSales = {};
        // Category-wise total sales
        const categorySales = {};
        // Festival occurrences
        const festivals = new Set();

        quarterData.forEach((row) => {
            const { sku, category, sales } = row;
            const saleValue = parseFloat(sales);

            // SKU sales
            if (!skuSales[sku]) skuSales[sku] = 0;
            skuSales[sku] += saleValue;

            // Category sales
            if (!categorySales[category]) categorySales[category] = 0;
            categorySales[category] += saleValue;

            // Detect festivals
            if (row.is_diwali === "1") festivals.add("Diwali");
if (row.is_ganesh_chaturthi === "1") festivals.add("Ganesh Chaturthi");
if (row.is_gudi_padwa === "1") festivals.add("Gudi Padwa");
if (row.is_eid === "1") festivals.add("Eid");
if (row.is_akshay_tritiya === "1") festivals.add("Akshay Tritiya");
if (row.is_dussehra_navratri === "1") festivals.add("Dussehra/Navratri");
if (row.is_onam === "1") festivals.add("Onam");
if (row.is_christmas === "1") festivals.add("Christmas");

        });

        const topSKUs = Object.entries(skuSales)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([sku, sales]) => ({ sku, sales }));

        // Get sales from the last 6 quarters
        let previousSales = {};
        for (let i = 1; i <= 6; i++) {
            const prevIndex = index - i;
            if (prevIndex >= 0) {
                const prevQuarter = quarterKeys[prevIndex];
                previousSales[prevQuarter] = analytics[prevQuarter]?.totalSales || 0;
            }
        }

        analytics[key] = {
            quarter: key,
            totalSales,
            totalOrders: quarterData.length,
            avgSalesPerOrder: (totalSales / quarterData.length).toFixed(2),
            topSKUs,
            skuSales, // 👈 Key-value pair for all SKUs
            categorySales, // 👈 Key-value pair for all categories
            festivals: [...festivals], // Convert Set to Array
            previousSales, // 👈 Key-value pair of last 6 quarters' sales
        };
    });

    return analytics;
}
module.exports={performAnalytics}