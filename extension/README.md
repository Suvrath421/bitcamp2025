<div align="center">
    <    <img src="/extension/logo/cyber-security_128.png" />
    <h1>Chrome Extension v3 Starter</h1>
    <h3>A minimal template of a Chrome v3 addon</h3>
</div>

This repository contains a Chrome/Chromium extension that uses the newest version of the manifest (v3). It includes functionality for analyzing the safety of file downloads and interacting with web pages via injected scripts.

You can use it as a basis to develop an extension.
It can also give you more insights about how to turn a v2 extension to v3.

In other words, this is a **working, installable v3 extension** example meant for you to **jumpstart** the development of your own extension.

---

## Features

- **File Safety Analysis**: 
  - Right-click on a link to test the safety of a file download using the "Test Download Safety" context menu option.
  - Sends the file URL to a backend service for analysis and displays the results, including virus scan and YARA rule matches.

- **Injected Foreground Script**:
  - Injects a script into web pages matching specific URL patterns.
  - Listens for messages from the extension's service worker and performs actions such as sending file URLs to the backend for analysis.

- **Popup Metrics**:
  - Provides a popup interface that retrieves and displays performance metrics for the active tab.
  - Includes functionality to reinitialize the debugger and update metrics periodically.

- **Settings Page**:
  - A simple settings page styled with custom CSS.

---

## Installation

- **Fork** this repo, then **clone your forked repo locally**. If you don't have a GitHub account, you can simply download a zip of the repo and unzip it on your computer.
- **Open [the extensions page](chrome://extensions)** in your browser: `chrome://extensions`. This link works on any Chromium-based browser.
- If you did not do it already, **toggle the "developer mode"**. This is usually a toggle button at the top right of the extensions page.
- Click the button **_load unpacked extension_**.
- In the window that pops up, **select the folder that contains this extension**, then **click _ok_**.
- **Done!** A new extension called _Chrome Addon v3 Starter_ should have appeared in the list.

---

## Q&A

> **What does the extension do?**

This extension provides tools for analyzing file download safety, interacting with web pages via injected scripts, and displaying performance metrics in a popup.

> **Does this work only on Chrome or on other web browsers as well?**

At the moment, this works on every Chromium-based web browser that supports v3 extensions. Therefore, you should be able to install this extension on any of the following browsers (as long as they are up-to-date):
- _Free and open-source browsers_:
    - Chromium
    - Brave
- _Proprietary browsers_:
    - Chrome
    - Edge
    - Vivaldi
    - Opera

> **Does this work on Chrome for Android/iOS?**

Chrome for mobile doesn't currently support extensions.

> **How does the file safety analysis work?**

When you right-click on a link and select "Test Download Safety," the extension sends the file URL to a backend service for analysis. The backend performs virus scans and YARA rule matching, and the results are displayed in an alert.

> **How do I debug the service worker?**

To debug the service worker:
- Load your extension with a working version of the service worker.
- Click on "service worker" on the page _chrome://extensions_. This will open the console attached to the service worker.
- Paste your code in the console and see if any error is logged.

---

## External Resources

- [Official feature summary for manifest v3](https://developer.chrome.com/docs/extensions/mv3/intro/mv3-overview/)
- [Migrating from v2 to v3](https://developer.chrome.com/docs/extensions/mv3/intro/mv3-migration/) + [very useful checklist once you think you are done](https://developer.chrome.com/docs/extensions/mv3/mv3-migration-checklist/)
- [Excellent write-ups of a migration](https://github.com/kentbrew/learning-manifest-v3)
- [Another example of a v3 extension (older code)](https://gist.github.com/dotproto/3a328d6b187621b445499ba503599dc0)
