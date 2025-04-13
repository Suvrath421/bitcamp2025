// server.js
const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");

const app = express();
app.use(express.text());

let latestResult = {};

// Configure the URL and rule file. (Adjust these to your needs.)
const ruleFile = "rules.yar"; // Ensure this is the correct absolute path if needed.

app.get('/run-scan', (req, res) => {
  const tabUrl = req.query.url; // Grab the URL sent from the popup
  console.log("Received /run-scan request with URL:", tabUrl);
  
  if (!tabUrl) {
    console.error("URL parameter missing in /run-scan request.");
    return res.status(400).send("Missing URL parameter");
  }
  
  // Execute your bash script. Ensure scan_site.sh is executable (chmod +x scan_site.sh)
  exec(`bash scan_site.sh "${tabUrl}" "${ruleFile}"`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing scan: ${error}`);
      console.error(stderr);
      return res.status(500).send("Error executing scan.");
    }
    console.log("Scan output:", stdout);
    res.send(stdout);
  });
});


app.post("/write-csv", (req, res) => {
  const csvPath = "./stats.csv"
  // Overwrite the file with header and the current row.
  fs.writeFileSync(csvPath, "cpu_delta,memory_delta,network_delta\n" + req.body);

  // Execute the updated Python script for stability analysis.
  exec("python3 analyze_zscore.py ./stats.csv", (err, stdout, stderr) => {
    if (err) {
      console.error("Python Error:", stderr);
      latestResult = { error: stderr };
      return res.status(500).send("Script failed");
    }

    try {
      latestResult = JSON.parse(stdout);
    } catch (e) {
      latestResult = { error: "Failed to parse Python output" };
    }

    res.send("CSV and analysis complete");
  });
});

app.get("/zscore", (req, res) => {
  console.log(latestResult);
  res.json(latestResult);
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
