// This script gets injected into any opened page
// whose URL matches the pattern defined in the manifest
// (see "content_script" key).
// Several foreground scripts can be declared
// and injected into the same or different pages.

console.log("This prints to the console of the page (injected only if the page url matched)")

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "contextMenuClicked") {
        
        const url = request.info.linkUrl;
        alert(`Testing Download Safety for ${url}`);   
        // TODO do this fetching later (once you are connected to the PI)
        // const response = await fetch()
    }
  });
