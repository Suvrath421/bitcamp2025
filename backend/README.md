# Backend for Bitcamp 2025

This repository contains the backend services for the Bitcamp 2025 project.
 
 <img src="/extension/logo/cyber-security_128.png" />

## Overview

The backend serves as the core infrastructure for the Bitcamp 2025 project. It provides a RESTful API to manage data, perform security scans, and analyze web pages for potential threats. It integrates with MongoDB for data storage and supports job-based processing for asynchronous tasks like URL analysis and scanning.

## Features

- RESTful API for managing data and processing jobs
- Security analysis endpoints for scanning web pages and testing for anomalies
- Asynchronous job handling with status tracking
- Integration with MongoDB for data persistence
- Authentication and authorization mechanisms
- Scalable architecture for handling multiple requests

## Requirements

- Node.js (v16 or later)
- npm (v7 or later)
- MongoDB (v5 or later)

## Installation

1. Install dependencies:
    ```bash
    npm install
    ```

## Usage

1. Start the development server:
    ```bash
    npm run dev
    ```
2. Access the API at `http://localhost:3000`.

## Key Endpoints

- **`POST /analyze`**: Submits a URL for analysis and returns a job ID for tracking.
- **`POST /scanpage`**: Initiates a scan of a web page for potential threats.
- **`POST /ztest`**: Performs statistical anomaly detection on provided data.
- **`GET /job/:id`**: Retrieves the status and result of a submitted job.

## Scripts

- `npm run dev`: Start the development server
- `npm start`: Start the production server
- `npm test`: Run tests

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.