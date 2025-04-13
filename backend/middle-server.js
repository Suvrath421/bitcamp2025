const express = require('express');
const app = express();
const cors = require('cors');
app.use(cors());
app.use(express.json());

const mongoose = require('mongoose');
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri = "mongodb+srv://mitjaipp:Soccer12321@cluster0.gzuyvsh.mongodb.net/data?retryWrites=true&w=majority&appName=Cluster0";

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  tls: true,
  tlsAllowInvalidCertificates: false,
  tlsAllowInvalidHostnames: false,
})
.then(() => {
  console.log("Connected to MongoDB via Mongoose!");
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
})
.catch(err => {
  console.error("MongoDB connection error via Mongoose:", err);
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
  const newRequest = {
    type: endpointType,  
    data: data,          
    status: "pending",   
    createdAt: new Date()
  };
  const result = await mongoose.connection.db.collection('requests').insertOne(newRequest);
  return result.insertedId;
}

// Endpoint for /analyze
app.post('/analyze', async (req, res) => {
  try {
    const data = req.body;
    const requestId = await storeRequest("analyze", data);
    res.json({ success: true, requestId });
  } catch (err) {
    console.error("Error in /analyze:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Endpoint for /ztest
app.post('/ztest', async (req, res) => {
  try {
    const data = req.body;
    const requestId = await storeRequest("ztest", data);
    res.json({ success: true, requestId });
  } catch (err) {
    console.error("Error in /ztest:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Endpoint for /scanpage
app.post('/scanpage', async (req, res) => {
  try {
    const data = req.body;
    const requestId = await storeRequest("scanpage", data);
    res.json({ success: true, requestId });
  } catch (err) {
    console.error("Error in /scanpage:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// Endpoint for polling job status/data using the Mongoose model.
app.get('/job/:id', async (req, res) => {
  try {
    const jobId = new ObjectId(req.params.id);
    const job = await mongoose.connection.db.collection('requests').findOne({ _id: jobId });
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json({ success: true, job });
  } catch (err) {
    console.error("Error in /job/:id", err);
    res.status(500).json({ error: "Server error" });
  }
});
