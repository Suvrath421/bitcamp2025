// This script gets injected into any opened page
// whose URL matches the pattern defined in the manifest
// (see "content_script" key).
// Several foreground scripts can be declared
// and injected into the same or different pages.

console.log("This prints to the console of the page (injected only if the page url matched)");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "contextMenuClicked") {
        let url = request.info.linkUrl;
        const myHeaders = new Headers();
        myHeaders.append('Content-Type', 'application/json');
        const raw = JSON.stringify({
            "url": url
        });
        alert('Download received... performing sandboxing now');
        const response = await fetch('https://bitcamp2025-backend.onrender.com/analyze', { 
            method: "POST", 
            headers: myHeaders,
            body: raw, 
        });
        const data = await response.json();
        if (!data.success) {
            return;
        }
        const id = data.requestId;
        url = `https://bitcamp2025-backend.onrender.com/job/${id}`;
        let res = null;
        while (true) {
            const r = await fetch(url);
            const d = await r.json();
            if (d.job.status === 'processed') {
                res = d.job.result[0];
                break;
            }
            await sleep(2500);
        }
        console.log(res);
        const message = 
        `File Download Notes: (blank implies that the file is safe)
        ${res.clamav_scan.includes("No virus") ? '' : 'Clamav: ' + res.clamav_scan}
        ${res.yara_matches.length === 0 || res.yara_matches[0] === 'No matches' ? '' : `Yara:\n${res.yara_matches.join('\n')}`}
        `.trim();
        alert(message);
    }
});

