/**
 * Analyze JSON data based on its type.
 * @param {Object} jsonData - The JSON data to analyze.
 * @param {string} type - The type of data: "analyze", "ztest", or "scan".
 */
function analyzeJson(jsonData, type) {
    switch (type) {
        case "analyze":
            if (jsonData.suspicion_level) {
                console.log(`Suspicion Level: ${jsonData.suspicion_level}`);
            } else {
                console.warn("Suspicion level not found in the analysis data.");
            }
            break;

        case "ztest":
            const metrics = ["cpu", "memory", "bytes_sent", "bytes_recv", "load"];
            metrics.forEach((metric) => {
                if (jsonData[metric]) {
                    jsonData[metric].forEach((entry) => {
                        console.log(
                            `${metric.toUpperCase()} - Value: ${entry.value}, Is Outlier: ${entry.is_outlier}, Z-Score: ${entry.z_score}`
                        );
                    });
                } else {
                    console.warn(`Metric ${metric} not found in the z-test data.`);
                }
            });
            break;

        case "scan":
            if (jsonData.output && jsonData.output.includes("No malicious patterns were detected")) {
                console.log("Scan Result: No malicious patterns were detected.");
            } else {
                console.warn("Scan Result: Malicious patterns may have been detected or output is missing.");
            }
            break;

        default:
            console.error("Unknown type. Please specify 'analyze', 'ztest', or 'scan'.");
    }
}

/**
 * Map each data type to its respective URL.
 */
const dataSources = {
    analyze: "https://example.com/analyze",
    ztest: "https://example.com/ztest",
    scan: "https://example.com/scan"
};

/**
 * Fetch and analyze all defined data sources.
 */
async function fetchAndAnalyze() {
    for (const [type, url] of Object.entries(dataSources)) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${type} data: ${response.statusText}`);
            }
            const data = await response.json();
            analyzeJson(data, type);
        } catch (error) {
            console.error(`Error handling ${type} data:`, error);
        }
    }
}

// Start the process
fetchAndAnalyze();
