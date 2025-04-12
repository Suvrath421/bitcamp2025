// server.js
const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");

const app = express();
app.use(express.text());

let latestResult = {};

app.post("/write-csv", (req, res) => {
  const csvPath = "stats.csv";
  // Overwrite the file with header and the current row.
  fs.writeFileSync(csvPath, "cpu_delta,memory_delta,network_delta\n" + req.body);

  // Execute the updated Python script for stability analysis.
  exec("python analyze_zscore.py stats.csv", (err, stdout, stderr) => {
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
