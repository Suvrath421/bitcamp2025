import { method } from "detect-libc";

/**
 * Analyze JSON data based on its type.
 * @param {Object} jsonData - The JSON data to analyze.
 * @param {string} type - The type of data: "analyze", "ztest", or "scan".
 */
function analyzeJson(jsonData, type) {
    switch (type) {
        case "analyze":
            try {
                const url = jsonData.file_url || 'N/A';
                const suspicionLevel = jsonData.suspicion_level || 'N/A';
                const suspicionScore = jsonData.suspicion_score ?? 'N/A'; // handles 0 properly
            
                return {
                  url,
                  suspicionLevel,
                  suspicionScore
                };
            } catch (error) {
                console.error("Failed to extract info:", error);
                return null;
            }
        case "ztest":
            const matrix = [];

            metrics.forEach((metric) => {
                if (jsonData[metric]) {
                    const values = [];
                    const isOutliers = [];
                    const zScores = [];

                    jsonData[metric].forEach((entry) => {
                        values.push(entry.value);
                        isOutliers.push(entry.is_outlier);
                        zScores.push(entry.z_score);
                    });

                    matrix.push([values, isOutliers, zScores]);
                } else {
                    console.warn(`Metric ${metric} not found in the z-test data.`);
                    matrix.push([[], [], []]); // still push empty row to preserve structure
                }
            });

            return matrix;

        case "scan":
            if (jsonData.output && jsonData.output.includes("No malicious patterns were detected")) {
                return "Scan Result: No malicious patterns were detected.";
            } else {
                return "Scan Result: Malicious patterns may have been detected or output is missing.";
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
    analyze: "https://bitcamp2025-backend.onrender.com/analyze",
    ztest: "https://bitcamp2025-backend.onrender.com/ztest",
    scan: "https://bitcamp2025-backend.onrender.com/scanpage",
    job: "https://bitcamp2025-backend.onrender.com/job"//+<id>
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ztest

async function fetch_ztest(url) {
    const response = await fetch(dataSources.ztest, { method: "POST", body: { url: url } } );
    const data = await response.json();
    if (!data.success) {
        // Failed (shouldn't happen ever really)
        return;
    }
    const id = data.requestId;
    const url = `${dataSources[job]}/${id}`;
    while (true) {
        const r = await fetch(url);
        const d = await r.json();
        if (d.job.status === 'processed') {
            res = d[0];
            // d[1] contains the status code
            break;
        }
        await sleep(2500);
    }
}

async function fetch_analyze(url) {
    const response = await fetch(dataSources.analyze, { method: "POST", body: { url: url } } );
    const data = await response.json();
    if (!data.success) {
        // Failed (shouldn't happen ever really)
        return;
    }
    const id = data.requestId;
    const url = `${dataSources[job]}/${id}`;
    let res = null;
    while (true) {
        const r = await fetch(url);
        const d = await r.json();
        if (d.job.status === 'processed') {
            res = d[0];
            // d[1] contains the status code
            break;
        }
        await sleep(2500);
    }
    console.log(res);
}


async function fetch_scan(url) {
    const response = await fetch(dataSources.scan, { method: "POST", body: { url: url } } );
    const data = await response.json();
    if (!data.success) {
        // Failed (shouldn't happen ever really)
        return;
    }
    const id = data.requestId;
    const url = `${dataSources[job]}/${id}`;
    while (true) {
        const r = await fetch(url);
        const d = await r.json();
        if (d.job.status === 'processed') {
            res = d[0];
            // d[1] contains the status code
            break;
        }
        await sleep(2500);
    }
}


/**
 * Fetch and analyze all defined data sources.
 */
/*
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
*/
