// server.js
const express = require("express");
const fs = require("fs");
const { exec } = require("child_process");

const app = express();
app.use(express.text());

const mongoose = require("mongoose");
const {MongoClient, ServerApiVersion, ObjectId} = require('mongodb');

const uri = "mongodb+srv://mitjaipp:Soccer12321@cluster0.gzuyvsh.mongodb.net/data?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  tls:true,
  tlsAllowInvalidCertificates:false,
  tlsAllowInvalidHostnames:false,
})
  .then(() => {
    console.log("MongoDB connection established");
    const port = 3000; // Define a valid port number
    app.listen(port, () => {
      
      console.log(`Server running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error);
  process.exit(1);
  });

// Define the Job schema and model using Mongoose.
const jobSchema = new mongoose.Schema({
  type: { type: String, required: true },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, default: "pending" }, // "pending" or "processed"
  createdAt: { type: Date, default: Date.now },
  processedAt: { type: Date },
  result: { type: mongoose.Schema.Types.Mixed }
});
const Job = mongoose.model("Job", jobSchema);
// Helper function to insert a request into the "requests" collection.
// We use the active Mongoose connection to get the underlying native driver.
async function storeRequest(endpointType, data) {
  const newTask = {
    type: endpointType,  
    data: data,          
    status: "pending",   
    createdAt: new Date()
  };
  const result = await mongoose.connection.db.collection('tasks').insertOne(newTask);
  return result.insertedId;
}

 

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

  const newTask = {
    type: "scan",
    data: { url: tabUrl },
    status: "processing",
    createdAt: new Date()
  }

  const result = mongoose.connection.db.collection('tasks').insertOne(newTask);
  console.log(result)
  
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

    const newTask = {
      type: "stability",
      data: { cpu_delta: latestResult.cpu_delta, memory_delta: latestResult.memory_delta, network_delta: latestResult.network_delta },
      status: "processing",
      createdAt: new Date()
    }
  
    const result = mongoose.connection.db.collection('tasks').insertOne(newTask);
    console.log(result)

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
