//This file will be used to analze the json files of our main shell scipt

// We will have 3 main things here with our json files when we run stuff like our z=test-scipt

/**
 * Analyze JSON data based on its type.
 * @param {Object} jsonData - The JSON data to analyze.
 * @param {string} type - The type of data: "analyze", "ztest", or "scan".
 */
function analyzeJson(jsonData, type) {
    switch (type) {
        case "analyze":
            // Look for the suspicion_level
            if (jsonData.suspicion_level) {
                console.log(`Suspicion Level: ${jsonData.suspicion_level}`);
            } else {
                console.warn("Suspicion level not found in the analysis data.");
            }
            break;

        case "ztest":
            // Check for outliers in the metrics
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
            // Look for "no malicious patterns were detected" in the output
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

// Example usage
const analyzeData = {
    suspicion_level: "Low",
    // ... other fields
};

const ztestData = {
    cpu: [{ is_outlier: false, value: 22.5, z_score: 0.0735 }],
    memory: [{ is_outlier: false, value: 1.9, z_score: 0.0763 }],
    // ... other metrics
};

const scanData = {
    output: "No malicious patterns were detected.",
    // ... other fields
};

analyzeJson(analyzeData, "analyze");
analyzeJson(ztestData, "ztest");
analyzeJson(scanData, "scan");

/**
 * Fetch and analyze JSON data for all three types: analyze, ztest, and scan.
 */
async function fetchAndAnalyze() {
    try {
        // Fetch analyze data
        const analyzeResponse = await fetch("https://example.com/analyze");
        const analyzeData = await analyzeResponse.json();
        analyzeJson(analyzeData, "analyze");

        // Fetch ztest data
        const ztestResponse = await fetch("https://example.com/ztest");
        const ztestData = await ztestResponse.json();
        analyzeJson(ztestData, "ztest");

        // Fetch scan data
        const scanResponse = await fetch("https://example.com/scan");
        const scanData = await scanResponse.json();
        analyzeJson(scanData, "scan");
    } catch (error) {
        console.error("Error fetching or analyzing data:", error);
    }
}

// Call the function to fetch and analyze all data
fetchAndAnalyze();

// Here are some notes for our things we will be running