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


// ztest

async function fetch_ztest(url) {
    const myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    const raw = JSON.stringify({
        "url": url
    });
    const response = await fetch(dataSources.scan, { 
        method: "POST", 
        headers: myHeaders,
        body: raw, 
    });
    const data = await response.json();
    if (!data.success) {
        // Failed (shouldn't happen ever really)
        return;
    }
    const id = data.requestId;
    url = `${dataSources.job}/${id}`;
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
    console.log(res)
    return res
}

async function fetch_analyze(url) {
    const myHeaders = new Headers();
    myHeaders.append('Content-Type', 'application/json');
    const raw = JSON.stringify({
        "url": url
    });
    const response = await fetch(dataSources.scan, { 
        method: "POST", 
        headers: myHeaders,
        body: raw, 
    });
    const data = await response.json();
    if (!data.success) {
        // Failed (shouldn't happen ever really)
        return;
    }
    const id = data.requestId;
    url = `${dataSources.job}/${id}`;
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
    return res;
}


// Define a sleep function
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  export async function fetch_scan(url) {
    try {
      const myHeaders = new Headers();
      myHeaders.append('Content-Type', 'application/json');
      const raw = JSON.stringify({ url: url });
      
      // Send initial scan request
      const response = await fetch(dataSources.scan, { 
        method: "POST", 
        headers: myHeaders,
        body: raw, 
      });
      const data = await response.json();
      
      if (!data.success) {
        console.error("Scan request failed:", data);
        return "Scan request failed";
      }
      
      const id = data.requestId;
      let jobUrl = `${dataSources.job}/${id}`;
      console.log("Job URL:", jobUrl);
  
      // Set a maximum iteration count to avoid infinite loops
      const maxIterations = 100;
      let iterations = 0;
  
      while (iterations < maxIterations) {
        iterations++;
        const r = await fetch(jobUrl);
        const d = await r.json();
  
        if (d.job.status === 'processed') {
          let res = d.job.result[0];
          console.log("Output from job result:", res.output);
          await sleep(2500); // Pause before returning result
          return res.output;
        } else {
          console.log(`Attempt ${iterations}: job status is "${d.job.status}", retrying...`);
          await sleep(2500); // Wait before next poll
        }
      }
  
      console.error("Max iterations reached without processing");
      return "Timeout: Max iterations reached without processing";
    } catch (error) {
      console.error("Error in fetch_scan:", error);
      return "Error occurred in fetch_scan";
    }
  }
  

console.log("Result: " + fetch_scan("https://youtube.com"))



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
