import { chat } from '../gemini.js';

const DEBUGGER_PROTOCOL_VERSION = "1.3";
let activeTabId = null;
let simulatedMalicious = false; // simulate malicious state once per session

// Smoothing variables (for all metrics)
let smoothedCpu = null;
let smoothedRam = null;
let smoothedChromePerf = null;
const alpha = 0.3; // smoothing factor

// Variables for improved CPU calculation.
let prevTaskDuration = null;      // Previous TaskDuration metric (seconds)
let prevCpuTimestamp = null;        // Timestamp of previous measurement (milliseconds)


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

  //console.log(`Smoothed Metrics -> CPU: ${cpuUsage.toFixed(1)}%, RAM: ${ramUsage.toFixed(1)} MB, ChromePerf: ${chromePerf.toFixed(1)} ms, Score: ${score}`);

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

    // Chrome Performance: Simulated value (for demonstration).
    let chromePerf = Math.random() * 150; // simulate up to 150 ms
    smoothedChromePerf = smooth(chromePerf, smoothedChromePerf);
    document.getElementById("chromePerf").textContent =
      smoothedChromePerf.toFixed(1) + " ms";

    // GPU Usage: No public API available; display "N/A".
    document.getElementById("gpuUsage").textContent = "N/A";

    // Network Activity: Simulated value.
    let networkActivity = Math.floor(Math.random() * 500);
    document.getElementById("networkActivity").textContent = networkActivity + " KB/s";

    // Assess resource intensity using the smoothed metrics.
    let intensity = assessResourceIntensity(smoothedCpu, smoothedRam, smoothedChromePerf);
    const resourceIndicatorEl = document.getElementById("resourceIndicator");
    if (intensity === "High") {
      resourceIndicatorEl.textContent = "High";
      resourceIndicatorEl.className = "px-2 py-1 rounded text-xs font-semibold bg-red-600";
    } else if (intensity === "Medium") {
      resourceIndicatorEl.textContent = "Medium";
      resourceIndicatorEl.className = "px-2 py-1 rounded text-xs font-semibold bg-yellow-500 text-gray-900";
    } else {
      resourceIndicatorEl.textContent = "Low";
      resourceIndicatorEl.className = "px-2 py-1 rounded text-xs font-semibold bg-green-600";
    }

    // Update the malicious indicator based on the simulated state.
    const maliciousIndicatorEl = document.getElementById("maliciousIndicator");
    if (simulatedMalicious) {
      maliciousIndicatorEl.textContent = "Yes";
      maliciousIndicatorEl.className = "px-2 py-1 rounded text-xs font-semibold bg-red-600";
    } else {
      maliciousIndicatorEl.textContent = "No";
      maliciousIndicatorEl.className = "px-2 py-1 rounded text-xs font-semibold bg-green-600";
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
        updateMetrics(tabId);
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
      document.getElementById("gpuUsage").textContent = "N/A";
      document.getElementById("ramUsage").textContent = "N/A";
      document.getElementById("chromePerf").textContent = "N/A";
      document.getElementById("networkActivity").textContent = "N/A";
      document.getElementById("resourceIndicator").textContent = "N/A";
      document.getElementById("maliciousIndicator").textContent = "N/A";
      document.getElementById("lastUpdate").textContent = "Restricted Page";
      return;
    }

    // Simulate malicious state once (30% chance).
    simulatedMalicious = Math.random() < 0.3;

    attachDebugger(activeTabId, () => {
      enablePerformance(activeTabId, () => {
        setInterval(() => updateMetrics(activeTabId), 1000);
        updateMetrics(activeTabId);
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

