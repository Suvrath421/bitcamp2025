// background.js

// ==============================
// Constants and Global Variables
// ==============================
const DEBUGGER_PROTOCOL_VERSION = "1.3";
const ALPHA = 0.3; // Smoothing factor for metrics

// Object to hold metrics and monitoring state per tab
let tabMetrics = {};

// ==============================
// Utility Functions
// ==============================

/**
 * Smooth a new value using exponential smoothing.
 * @param {number} newValue - New measurement.
 * @param {number|null} prevSmooth - Previous smoothed value.
 * @returns {number} - The updated smoothed value.
 */
function smooth(newValue, prevSmooth) {
  return prevSmooth === null ? newValue : ALPHA * newValue + (1 - ALPHA) * prevSmooth;
}

// ==============================
// Debugger and Monitoring Logic
// ==============================

/**
 * Attach debugger to a tab and start monitoring its performance metrics.
 * @param {number} tabId - The ID of the tab to monitor.
 */
function attachAndMonitorTab(tabId) {
  if (tabMetrics[tabId]?.monitoring) return; // Avoid duplicate monitoring

  // Initialize metrics for the tab
  tabMetrics[tabId] = {
    monitoring: true,
    smoothedCpu: null,
    smoothedRam: null,
    prevTaskDuration: null,
    prevCpuTimestamp: null,
    current: {}
  };

  // Attach debugger to the tab
  chrome.debugger.attach({ tabId }, DEBUGGER_PROTOCOL_VERSION, () => {
    if (chrome.runtime.lastError) {
      console.error(`Error attaching debugger to tab ${tabId}:`, chrome.runtime.lastError.message);
      return;
    }

    // Enable performance monitoring and start updating metrics
    chrome.debugger.sendCommand({ tabId }, "Performance.enable", {}, () => {
      tabMetrics[tabId].intervalId = setInterval(() => updateMetrics(tabId), 1000);
    });
  });
}

/**
 * Update performance metrics for a given tab.
 * @param {number} tabId - The ID of the tab.
 */
function updateMetrics(tabId) {
  chrome.debugger.sendCommand({ tabId }, "Performance.getMetrics", {}, (result) => {
    if (chrome.runtime.lastError || !result) {
      console.error(`Error retrieving metrics for tab ${tabId}:`, chrome.runtime.lastError?.message || "No result");
      return;
    }

    const metricsObj = tabMetrics[tabId];
    if (!metricsObj) return;

    const metrics = Object.fromEntries(result.metrics.map(metric => [metric.name, metric.value]));

    // Calculate CPU usage
    const currentTaskDuration = metrics["TaskDuration"] || 0;
    const currentTimestamp = Date.now();
    if (metricsObj.prevTaskDuration !== null && metricsObj.prevCpuTimestamp !== null) {
      const deltaCpu = ((currentTaskDuration - metricsObj.prevTaskDuration) / ((currentTimestamp - metricsObj.prevCpuTimestamp) / 1000)) * 100;
      metricsObj.smoothedCpu = smooth(Math.max(0, deltaCpu), metricsObj.smoothedCpu);
    }
    metricsObj.prevTaskDuration = currentTaskDuration;
    metricsObj.prevCpuTimestamp = currentTimestamp;

    // Calculate RAM usage
    const currentRam = (metrics["JSHeapUsedSize"] || 0) / (1024 * 1024); // Convert bytes to MB
    metricsObj.smoothedRam = smooth(currentRam, metricsObj.smoothedRam);

    // Update current metrics
    metricsObj.current = {
      cpu: metricsObj.smoothedCpu,
      ram: metricsObj.smoothedRam,
      lastUpdate: new Date().toLocaleTimeString(),
    };
  });
}


// ==============================
// Event Listeners
// ==============================

/**
 * Listen for messages from the popup to supply metrics.
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "getTabMetrics") {
    const tabId = message.tabId;
    if (!tabMetrics[tabId]) {
      attachAndMonitorTab(tabId);
    }
    sendResponse(tabMetrics[tabId]?.current || {});
  }
  return true;
});

/**
 * Clean up when a tab is closed.
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabMetrics[tabId]) {
    clearInterval(tabMetrics[tabId].intervalId);
    chrome.debugger.detach({ tabId });
    delete tabMetrics[tabId];
  }
});
