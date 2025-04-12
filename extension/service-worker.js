import { chat } from './gemini.js';

console.log("Service worker module loaded");

async function handleChat() {
    try {
        const response = await chat("Explain how AI works");
        console.log("AI Response:", response);
    } catch (err) {
        console.error("Chat error:", err);
    }
}

handleChat();

// Manage the right-click menu

chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
      id: "myContextMenu",
      title: "Test Download Safety",
      contexts: ["link"]
    });
  });
  
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "myContextMenu") {
      console.log("Right-click menu clicked!");
      // Example: send a message to the content script
      chrome.tabs.sendMessage(tab.id, { action: "contextMenuClicked", info });
    }
  });