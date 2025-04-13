const DEBUGGER_PROTOCOL_VERSION = "1.3";
let activeTabId = null;

// Smoothing variables (for all metrics)
let smoothedCpu = null;
let smoothedRam = null;
const alpha = 0.3; // smoothing factor

// Variables for improved CPU calculation.
let prevTaskDuration = null;      // Previous TaskDuration metric (seconds)
let prevCpuTimestamp = null;        // Timestamp of previous measurement (milliseconds)
// New global variables for network delta simulation
// Global variables for actual network metrics:

// Global variables for network metrics - simplified
let networkTotalBytes = 0;         // Cumulative total bytes (sent + received)
let prevNetworkDeltaBytes = 0;     // Previous delta measurement for change calculation
let initialNetworkCaptured = false; // Flag to track initial load completion


// Variables for CPU and RAM delta calculation.
let prevSmoothedCpu = null;
let prevSmoothedRam = null;

/**
 * Utility to smooth values using exponential smoothing.
 * @param {number} newValue - The new measurement.
 * @param {number|null} prevSmooth - The previous smoothed measurement.
 * @returns {number} - The new smoothed value.
 */
function smooth(newValue, prevSmooth) {
  return prevSmooth === null ? newValue : alpha * newValue + (1 - alpha) * prevSmooth;
}

/**
 * Assess resource intensity based on provided (smoothed) metrics.
 * @param {number} cpuUsage - CPU usage percentage.
 * @param {number} ramUsage - JS Heap usage in MB.
 * @param {number} chromePerf - Performance metric in ms.
 * @returns {string} "High", "Medium", or "Low".
 */
function assessResourceIntensity(cpuUsage, ramUsage, chromePerf) {
  let score = 0;
  // Adjust thresholds as needed. For demonstration:
  if (cpuUsage > 40) score++;       // Flag if CPU exceeds 40%
  if (ramUsage > 30) score++;       // Flag if RAM exceeds 30 MB
  if (chromePerf > 100) score++;    // Flag if chromePerf exceeds 100 ms

  console.log(`Smoothed Metrics -> CPU: ${cpuUsage.toFixed(1)}%, RAM: ${ramUsage.toFixed(1)} MB, Score: ${score}`);

  if (score >= 2) return "High";
  if (score === 1) return "Medium";
  return "Low";
}

/**
 * Checks if a given URL belongs to a restricted domain.
 */
function isRestricted(url) {
  return url.includes("docs.google.com") ||
    url.startsWith("chrome://") ||
    url.startsWith("chrome-extension://") ||
    url.includes("gemini");
}

/**
 * Attach the debugger to the given tab.
 */
function attachDebugger(tabId, callback) {
  chrome.debugger.attach({ tabId }, DEBUGGER_PROTOCOL_VERSION, () => {
    if (chrome.runtime.lastError) {
      const errorMsg = chrome.runtime.lastError.message;
      if (errorMsg && errorMsg.includes("Another debugger is already attached")) {
        console.warn("Debugger already attached to tab " + tabId + ". Proceeding.");
        callback();
        return;
      }
      console.error("Error attaching debugger:", errorMsg);
      setTimeout(() => attachDebugger(tabId, callback), 2000);
      return;
    }
    callback();
  });
}

/**
 * Enable the Performance domain for the debugger.
 */
function enablePerformance(tabId, callback) {
  chrome.debugger.sendCommand({ tabId }, "Performance.enable", {}, () => {
    if (chrome.runtime.lastError) {
      console.error("Performance.enable error:", chrome.runtime.lastError.message);
      return;
    }
    callback();
  });
}


/**
 * Enable the Network domain.
 */
function enableNetwork(tabId, callback) {
  // Reset network metrics on enable
  networkTotalBytes = 0;
  prevNetworkDeltaBytes = 0;
  initialNetworkCaptured = false;

  chrome.debugger.sendCommand({ tabId }, "Network.enable", {}, () => {
    if (chrome.runtime.lastError) {
      console.error("Network.enable error:", chrome.runtime.lastError.message);
      return;
    }

    // Immediately capture load time to avoid timing issues
    captureLoadTime(tabId);

    if (callback) callback();
  });
}

function captureLoadTime(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      return new Promise((resolve) => {
        // If page has already loaded, get the timing immediately
        if (document.readyState === 'complete') {
          const navEntries = performance.getEntriesByType("navigation");
          if (navEntries.length > 0) {
            resolve(navEntries[0].loadEventEnd - navEntries[0].startTime);
          } else {
            // Fallback for older browsers
            const timing = performance.timing;
            resolve(timing.loadEventEnd - timing.navigationStart);
          }
        } else {
          // Otherwise, wait for the load event
          window.addEventListener('load', () => {
            // Give a small delay to ensure metrics are complete
            setTimeout(() => {
              const navEntries = performance.getEntriesByType("navigation");
              if (navEntries.length > 0) {
                resolve(navEntries[0].loadEventEnd - navEntries[0].startTime);
              } else {
                // Fallback for older browsers
                const timing = performance.timing;
                resolve(timing.loadEventEnd - timing.navigationStart);
              }
            }, 100);
          }, { once: true });
        }
      });
    }
  }, (results) => {
    if (chrome.runtime.lastError) {
      console.error("Error capturing load time:", chrome.runtime.lastError.message);
      return;
    }

    if (results && results[0] && results[0].result !== undefined) {
      const loadTime = results[0].result;
      // Update the load time display
      document.getElementById("loadTime").textContent = loadTime + " ms";
    }
  });
}

chrome.debugger.onEvent.addListener(function (source, method, params) {
  if (source.tabId !== activeTabId) return;

  if (method === "Network.dataReceived" || method === "Network.requestWillBeSent") {
    let bytesAdded = 0;

    if (method === "Network.dataReceived") {
      bytesAdded = params.dataLength;
    } else if (params.request) {
      // Estimate sent bytes for requests
      let sentEstimate = JSON.stringify(params.request.headers).length;
      if (params.request.postData) {
        sentEstimate += params.request.postData.length;
      }
      bytesAdded = sentEstimate;
    }

    // Add to cumulative total
    networkTotalBytes += bytesAdded;

    // If this is first network activity, mark the initial load
    if (!initialNetworkCaptured && networkTotalBytes > 0) {
      document.getElementById("initialNetworkActivity").textContent =
        (networkTotalBytes / 1024).toFixed(1) + " KB";
      initialNetworkCaptured = true;
      prevNetworkDeltaBytes = networkTotalBytes; // Initialize previous total
    }
  }
});


/**
 * Retrieve performance metrics via the debugger, update UI, and apply smoothing.
 */
function updateMetrics(tabId) {
  chrome.debugger.sendCommand({ tabId }, "Performance.getMetrics", {}, (result) => {
    if (chrome.runtime.lastError || !result) {
      console.error("getMetrics error:", chrome.runtime.lastError ? chrome.runtime.lastError.message : "No result");
      // Try reinitializing debugger if an error occurs.
      reinitializeDebugger(tabId);
      return;
    }

    const metrics = {};
    for (const metric of result.metrics) {
      metrics[metric.name] = metric.value;
    }

    // Improved CPU Usage Calculation:
    const currentTaskDuration = metrics["TaskDuration"] !== undefined ? metrics["TaskDuration"] : 0;
    const currentTimestamp = Date.now(); // in milliseconds
    let measuredCpu = 0;
    if (prevTaskDuration !== null && prevCpuTimestamp !== null) {
      // Calculate CPU usage as percentage of time the CPU was busy.
      measuredCpu = ((currentTaskDuration - prevTaskDuration) / ((currentTimestamp - prevCpuTimestamp) / 1000)) * 100;
      // Clamp negative values to 0.
      if (measuredCpu < 0) measuredCpu = 0;
    } else {
      // On the very first measurement, we cannot calculate the delta.
      measuredCpu = 0;
    }
    // Update the previous values for the next round.
    prevTaskDuration = currentTaskDuration;
    prevCpuTimestamp = currentTimestamp;

    // Apply smoothing.
    smoothedCpu = smooth(measuredCpu, smoothedCpu);
    document.getElementById("cpuUsage").textContent =
      (smoothedCpu ? smoothedCpu.toFixed(1) : "N/A") + (smoothedCpu ? "%" : "");

    // RAM Usage: Use "JSHeapUsedSize" (convert from bytes to MB).
    let ramUsage = metrics["JSHeapUsedSize"] !== undefined ? (metrics["JSHeapUsedSize"] / (1024 * 1024)) : 0;
    smoothedRam = smooth(ramUsage, smoothedRam);
    document.getElementById("ramUsage").textContent =
      (smoothedRam ? smoothedRam.toFixed(1) : "N/A") + (smoothedRam ? " MB" : "");

    // Calculate change in network activity (delta)
    const deltaNetworkBytes = networkTotalBytes - prevNetworkDeltaBytes;
    document.getElementById("changeInNetworkActivity").textContent =
      (deltaNetworkBytes / 1024).toFixed(1) + " KB/s";

    // Update cumulative network activity
    document.getElementById("initialNetworkActivity").textContent =
      (networkTotalBytes / 1024).toFixed(1) + " KB";

    // Update previous total bytes for the next calculation
    prevNetworkDeltaBytes = networkTotalBytes;


    // Compute CPU and Memory Delta values.
    let cpuDelta = (prevSmoothedCpu !== null) ? (smoothedCpu - prevSmoothedCpu) : 0;
    let ramDelta = (prevSmoothedRam !== null) ? (smoothedRam - prevSmoothedRam) : 0;
    document.getElementById("cpuDelta").textContent = cpuDelta.toFixed(1) + "%";
    document.getElementById("ramDelta").textContent = ramDelta.toFixed(1) + " MB";
    prevSmoothedCpu = smoothedCpu;
    prevSmoothedRam = smoothedRam;


    // Assess resource intensity based on the smoothed metrics.
    let intensity = assessResourceIntensity(smoothedCpu, smoothedRam);
    const resourceIndicatorEl = document.getElementById("resourceIndicator");
    if (intensity === "High") {
      resourceIndicatorEl.textContent = "High";
      resourceIndicatorEl.style.color = "red";
    } else if (intensity === "Medium") {
      resourceIndicatorEl.textContent = "Medium";
      resourceIndicatorEl.style.color = "yellow";
    } else {
      resourceIndicatorEl.textContent = "Low";
      resourceIndicatorEl.style.color = "green";
    }


    // Update the last updated timestamp.
    document.getElementById("lastUpdate").textContent = new Date().toLocaleTimeString();
  });
}

/**
 * Attempts to reinitialize the debugger by detaching and then reattaching.
 */
function reinitializeDebugger(tabId) {
  chrome.debugger.detach({ tabId }, () => {
    console.warn("Reattaching debugger to tab " + tabId + "...");
    attachDebugger(tabId, () => {
      enablePerformance(tabId, () => {
        enableNetwork(tabId, () => {
          setInterval(() => updateMetrics(activeTabId), 1000);
          updateMetrics(activeTabId);
        });
      });
    });
  });
}

/**
 * Initialize the extension: query the active tab, check restrictions, simulate malicious state,
 * attach the debugger, and start periodic metric updates.
 */
function init() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.error("No active tab found");
      return;
    }
    activeTabId = tabs[0].id;
    const tabUrl = tabs[0].url || "";

    if (isRestricted(tabUrl)) {
      console.warn("Restricted page. Metrics not available.");
      document.getElementById("cpuUsage").textContent = "N/A";
      document.getElementById("ramUsage").textContent = "N/A";
      document.getElementById("initialNetworkActivity").textContent = "N/A";
      document.getElementById("resourceIndicator").textContent = "N/A";
      document.getElementById("maliciousIndicator").textContent = "N/A";
      document.getElementById("lastUpdate").textContent = "Restricted Page";
      document.getElementById("changeInNetworkDelta").textContent = "-- / --";
      document.getElementById("cpuDelta").textContent = "--%";
      document.getElementById("ramDelta").textContent = "-- MB";
      document.getElementById("loadTime").textContent = "N/A";
      return;
    }

    // Simulate malicious state once (30% chance).

    attachDebugger(activeTabId, () => {
      enablePerformance(activeTabId, () => {
        enableNetwork(activeTabId, () => {
          // Periodically update the metrics.
          setInterval(() => updateMetrics(activeTabId), 1000);
          updateMetrics(activeTabId);

          // Start writing metrics to CSV every 5 seconds.
          setInterval(() => {
            writeMetricsToCSV();
          }, 5000);

        });

      });
    });

  });
}

/**
 * Cleanup: detach the debugger when the popup is closed.
 */
function cleanup() {
  if (activeTabId !== null) {
    chrome.debugger.detach({ tabId: activeTabId });
  }
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("unload", cleanup);

document.addEventListener("DOMContentLoaded", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || tabs.length === 0) {
      console.error("No active tab found");
      return;
    }
    const activeTabId = tabs[0].id;

    // Function to request and update the UI with metrics for the active tab.
    function updateUI() {
      chrome.runtime.sendMessage({ type: "getTabMetrics", tabId: activeTabId }, (metrics) => {
        if (!metrics || Object.keys(metrics).length === 0) return;
        document.getElementById("cpuUsage").textContent = metrics.cpu ? metrics.cpu.toFixed(1) + "%" : "N/A";
        document.getElementById("ramUsage").textContent = metrics.ram ? metrics.ram.toFixed(1) + " MB" : "N/A";
        document.getElementById("cpuDelta").textContent = metrics.deltaCpu ? metrics.deltaCpu.toFixed(1) + "%" : "N/A";
        document.getElementById("ramDelta").textContent = metrics.deltaRam ? metrics.deltaRam.toFixed(1) + " MB" : "N/A";
        document.getElementById("networkDelta").textContent = metrics.deltaNetworkSent + " / " + metrics.deltaNetworkReceived;
        document.getElementById("loadTime").textContent = metrics.loadTime + " ms";
        document.getElementById("lastUpdate").textContent = metrics.lastUpdate;
      });
    }
    // Update the UI immediately, and then every second.
    updateUI();
    setInterval(updateUI, 1000);
  });
});


async function writeMetricsToCSV(metrics) {
  const cpuDelta = (smoothedCpu !== null ? smoothedCpu : 0).toFixed(2);
  const memoryDelta = (smoothedRam !== null ? smoothedRam : 0).toFixed(2);
  const network = networkTotalBytes - prevNetworkDeltaBytes;

  const csvRow = `${cpuDelta},${memoryDelta},${network}\n`;

  fetch("http://localhost:3000/write-csv", {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: csvRow,
  });
}


function updateZScoreStatus() {
  fetch("http://localhost:3000/zscore")
    .then(res => res.json())
    .then(data => {
      // Get each designated element separately.
      const cpuEl = document.getElementById("cpuStatus");
      const memoryEl = document.getElementById("memoryStatus");
      const networkEl = document.getElementById("networkStatus");

      // Update the text content for each metric.
      cpuEl.textContent = data.cpu;
      memoryEl.textContent = data.memory;
      networkEl.textContent = data.network;

      // Check each metric's stability status and update the class accordingly.
      // Instead of applying a class on the container, modify the text color.
      cpuEl.style.color = data.cpu === "Unstable" ? "red" : "#68d391";;
      memoryEl.style.color = data.memory === "Unstable" ? "red" : "#68d391";;
      networkEl.style.color = data.network === "Unstable" ? "red" : "#68d391";;
    })
    .catch(err => {
      console.error("Error fetching stability status:", err);
    });
}


// ... [Rest of the existing popup.js code remains unchanged, including init, updateMetrics, and writeMetricsToCSV] ...

setInterval(updateZScoreStatus, 5000);


function runScan() {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    if (!tabs || !tabs.length) {
      console.error("No active tab found.");
      return;
    }
    const tabUrl = tabs[0].url;
    fetch('http://localhost:3000/run-scan?url=' + encodeURIComponent(tabUrl))
      .then(response => response.text())
      .then(result => {
        // Display the complete scan output in a designated element


        // Get the malicious code indicator element.
        const indicatorEl = document.getElementById("maliciousIndicator");

        // If scan output indicates no malicious patterns or there's a 403 error, mark it as "No".
        if (result.includes("No malicious patterns were detected") || result.includes("403: Forbidden")) {
          indicatorEl.textContent = "No";
          indicatorEl.style.color = "green";

        } else {
          // Otherwise, assume malicious code is detected.
          indicatorEl.textContent = "Yes";
          indicatorEl.style.color = "red";

        }
      })
      .catch(err => {
        console.error("Error running scan:", err?.message || "Unknown error occurred");
        const indicatorEl = document.getElementById("maliciousIndicator");
        if (indicatorEl) {
          indicatorEl.textContent = "Error";
          indicatorEl.style.color = "orange";
        }
      });
  });
}

// Run scan immediately and schedule every 30 seconds.
runScan();
setInterval(runScan, 30000);



