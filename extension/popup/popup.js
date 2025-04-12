// popup.js
import { chat } from '../gemini.js';

let aiScoreGenerated = false;

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
      <p style="margin-top: 10px; font-size: 13px;">Risk Level: ${scoreValue >= 80 ? 'High' : scoreValue >= 50 ? 'Medium' : 'Low'}</p>
      <div style="margin: 15px 10px; font-size: 13px; line-height: 1.4; color: #ccc;">${explanation}</div>
      <button id="viewStatsBtn" style="margin-top: 10px; padding: 8px 16px; background-color: #4CAF50; color: white; border: none; border-radius: 5px; font-size: 14px; cursor: pointer;">View Statistics</button>
    </div>
  `;
}

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

async function generateAISuggestion() {
  try {
    // Get the current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab.url).hostname; // Get just the domain

    const prompt = `Based on the following data, assign a cybersecurity safety score from 0 to 100 (where 100 is completely safe and 0 is highly unsafe). Provide your score on one line, and give a one- to two-sentence explanation on a separate line.

System Resource Anomalies:
	◦	CPU: ${cpu_anom}
	◦	Memory Usage: ${mem_anom}
	◦	Network Bytes Sent: ${sent_anom}
	◦	Network Bytes Received: ${recv_anom}
Malicious Code Scan Result:
	◦	${flag}
Domain Name:
	◦	${url}
Provide output in this format:
[0–100]
Explanation: [One to two concise sentences]`;

    const response = await chat(prompt);
    const match = response.match(/\b(\d{1,3})\b[\s\S]*?(Explanation:\s.+)/i);
    const numericScore = match ? parseInt(match[1]) : 0;
    const explanation = match ? match[2] : "Explanation: No explanation provided.";

    const resultEl = document.getElementById("aiSuggestionResult");
    resultEl.innerHTML = generateGaugeHTML(numericScore, explanation);

    document.getElementById("viewStatsBtn").addEventListener("click", showDashboardView);
  } catch (error) {
    console.error("Error fetching Gemini response:", error);
    document.getElementById("aiSuggestionResult").innerHTML = "<p>Error: Unable to fetch recommendation.</p>";
  }
}


document.getElementById("toScoreViewBtn").addEventListener("click", () => {
  showScoreView();
});

document.getElementById("backToDashboardBtn")?.addEventListener("click", showDashboardView);

document.addEventListener("DOMContentLoaded", () => {
  showScoreView();
});
