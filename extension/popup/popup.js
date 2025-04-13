// popup.js
import { chat } from '../gemini.js';

let aiScoreGenerated = false;

// Initialize variables with default values
let cpu_anom = "";
let mem_anom = "";
let network_anom = "";
let flag = "No malicious code detected";

// Function to update metrics from DOM elements
function updateMetricsFromDOM() {
  const cpuElement = document.getElementById("cpuUsage");
  const memElement = document.getElementById("ramUsage");
  const networkElement = document.getElementById("changeInNetworkActivity");
  const flagElement = document.getElementById("maliciousIndicator");
  
  if (cpuElement && memElement && networkElement && flagElement) {
    cpu_anom = cpuElement.textContent;
    mem_anom = memElement.textContent;
    network_anom = networkElement.textContent;
    flag = flagElement.textContent || "No malicious code detected";
    
    console.log("Updated Metrics:", {
      cpu_anom,
      mem_anom,
      network_anom,
      flag,
    });
  }
}

// Initial attempt to get values
updateMetricsFromDOM();

// Hook into metric.js events if available
document.addEventListener('DOMContentLoaded', () => {
  // Option 1: Check if metric.js exposes an update event or callback
  if (typeof window.metricJs !== 'undefined' && window.metricJs.onUpdate) {
    window.metricJs.onUpdate(function(metrics) {
      // If metric.js provides metrics directly
      if (metrics) {
        cpu_anom = metrics.cpu || cpu_anom;
        mem_anom = metrics.memory || mem_anom;
        network_anom = metrics.network || network_anom;
        flag = metrics.flag || flag;
        
        console.log("Metrics Updated from event:", {
          cpu_anom,
          mem_anom,
          network_anom,
          flag,
        });
      } else {
        // If not, try to fetch from DOM again
        updateMetricsFromDOM();
      }
    });
  } else {
    // Option 2: Use a custom event if metric.js emits one
    window.addEventListener('metricsUpdated', function(e) {
      if (e.detail) {
        cpu_anom = e.detail.cpu || cpu_anom;
        mem_anom = e.detail.memory || mem_anom;
        network_anom = e.detail.network || network_anom;
        flag = e.detail.flag || flag;
        
        console.log("Metrics Updated from custom event:", {
          cpu_anom,
          mem_anom,
          network_anom,
          flag,
        });
      } else {
        updateMetricsFromDOM();
      }
    });
    
    // Option 3: As a fallback, poll for updates
    const metricsInterval = setInterval(updateMetricsFromDOM, 1000);
    
    // Clear interval when popup is closed to prevent memory leaks
    window.addEventListener('unload', () => {
      clearInterval(metricsInterval);
    });
  }
});


function mapScoreToValue(scoreText) {
  if (scoreText.includes("High")) return 90;
  if (scoreText.includes("Medium")) return 60;
  return 30;
}

function getScoreColor(value) {
  if (value >= 80) return '#00e676'; // green
  if (value >= 50) return '#ffeb3b'; // yellow
  return '#ff1744'; // red
}

function generateGaugeHTML(scoreValue, explanation) {
  const color = getScoreColor(scoreValue);
  return `
    <style>
      .circular-chart {
        display: block;
        margin: 0 auto;
        max-width: 120px;
        max-height: 120px;
      }
      .circle-bg {
        fill: none;
        stroke: #ddd;
        stroke-width: 3.8;
      }
      .circle {
        fill: none;
        stroke-width: 4.5;
        stroke-linecap: round;
        stroke: ${color};
        animation: progress 1s ease-out forwards;
      }
      @keyframes progress {
        0% { stroke-dasharray: 0 100; }
        100% { stroke-dasharray: ${scoreValue} 100; }
      }
      .score-text {
        fill: #fff;
        font-size: 10px;
        font-weight: bold;
      }
    </style>
    <div style="text-align: center;">
      <svg viewBox="0 0 36 36" class="circular-chart">
        <path class="circle-bg"
              d="M18 2.0845
                 a 15.9155 15.9155 0 0 1 0 31.831
                 a 15.9155 15.9155 0 0 1 0 -31.831" />
        <path class="circle"
              stroke-dasharray="0, 100"
              d="M18 2.0845
                 a 15.9155 15.9155 0 0 1 0 31.831
                 a 15.9155 15.9155 0 0 1 0 -31.831" />
        <text x="18" y="20.35" text-anchor="middle" class="score-text">${scoreValue}</text>
      </svg>
      <p style="margin-top: 10px; font-size: 13px;">Safety Level: ${scoreValue >= 80 ? 'High' : scoreValue >= 50 ? 'Medium' : 'Low'}</p>
      <div style="margin: 15px 10px; font-size: 13px; line-height: 1.4; color: #ccc;">${explanation}</div>
      <button id="viewStatsBtn" style="margin-top: 10px; padding: 8px 16px; background-color: #4CAF50; color: white; border: none; border-radius: 5px; font-size: 14px; cursor: pointer;">View Statistics</button>
    </div>
  `;
}

async function generateAISuggestion() {
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url).hostname; // Get just the domain

    const prompt_num = `Based on the following data, assign a cybersecurity safety score from 0 to 100 (where 100 is completely safe and 0 is highly unsafe). Provide your score on one line.

System Resource Anomalies:
    ◦	CPU: ${cpu_anom}
    ◦	Memory Usage: ${mem_anom}
    ◦	Network Change in Bytes Sent: ${network_anom}
Malicious Code Scan Result:
    ◦	${flag}
Domain Name:
    ◦	${url}
Provide output in this format:
[0–100] (Only a number)`;

    console.log(prompt_num);

    const response_num = await chat(prompt_num);
    console.log(response_num);

    const prompt_expl = `Based on the following data,

System Resource Anomalies:
    ◦	CPU: ${cpu_anom}
    ◦	Memory Usage: ${mem_anom}
    ◦	Network Bytes Sent: ${network_anom}
Malicious Code Scan Result:
    ◦	${flag}
Domain Name:
    ◦	${url}

Provide explanation in [One to two concise sentences] of why this website is safe or unsafe in cybersecurity`;

console.log(prompt_num);

    const response_expl = await chat(prompt_expl);
    console.log(response_expl);

    const numericScore = response_num;
    const explanation = response_expl;

    const resultEl = document.getElementById("aiSuggestionResult");
    resultEl.innerHTML = generateGaugeHTML(numericScore, explanation);

    document.getElementById("viewStatsBtn").addEventListener("click", showDashboardView);
  } catch (error) {
    console.error("Error fetching Gemini response:", error);
    document.getElementById("aiSuggestionResult").innerHTML = "<p>Error: Unable to fetch recommendation.</p>";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const toScoreViewBtn = document.getElementById("toScoreViewBtn");

  // Attach event listeners
  if (backToDashboardBtn) {
    backToDashboardBtn.addEventListener("click", showDashboardView);
  }

  if (toScoreViewBtn) {
    toScoreViewBtn.addEventListener("click", showScoreView);
  }

  // Set the initial view to the dashboard
  showDashboardView();
});

function showScoreView() {
  document.getElementById("dashboardView").style.display = "none";
  document.getElementById("scoreView").style.display = "block";

  if (!aiScoreGenerated) {
    generateAISuggestion();
    aiScoreGenerated = true;
  }
}

function showDashboardView() {
  document.getElementById("scoreView").style.display = "none";
  document.getElementById("dashboardView").style.display = "block";
}