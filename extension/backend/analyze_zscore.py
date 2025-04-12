#!/usr/bin/env python3
import csv
import json
import os
import sys

# Check command line arguments for CSV filename
if len(sys.argv) < 2:
    sys.exit(1)

csv_filename = sys.argv[1]

# Read the CSV file (expecting one header row and one data row)
try:
    with open(csv_filename, 'r') as f:
        reader = csv.DictReader(f)
        data_rows = list(reader)
    # If there is no data, default to 0.0 for both metrics.
    if len(data_rows) == 0:
        current_cpu = 0.0
        current_memory = 0.0
        current_network = 0.0
    else:
        current_row = data_rows[0]
        current_cpu = float(current_row['cpu_delta'])
        current_memory = float(current_row['memory_delta'])
        current_network = float(current_row['network_delta'])
except Exception:
    sys.exit(1)

# Define the file where previous metrics are stored
prev_file = "prev_metrics.json"

# Initialize stability results to "stable"
result = {"cpu": "Stable", "memory": "Stable", "network": "Stable"}

# Load previous metrics if available and compare
if os.path.exists(prev_file):
    try:
        with open(prev_file, 'r') as pf:
            prev_data = json.load(pf)
        prev_cpu = float(prev_data.get("cpu", 0))
        prev_memory = float(prev_data.get("memory", 0))
        prev_network = float(prev_data.get("network", 0))
        # For CPU: if current is more than 2x previous then "unstable"
        if prev_cpu == 0:
            result["cpu"] = "Unstable" if current_cpu > 0 else "Stable"
        else:
            result["cpu"] = "Unstable" if current_cpu > 2 * prev_cpu else "Stable"
        # For memory: similar check
        if prev_memory == 0:
            result["memory"] = "Unstable" if current_memory > 0 else "Stable"
        else:
            result["memory"] = "Unstable" if current_memory > 2 * prev_memory else "Stable"

        if prev_network == 0:
            result["network"] = "Unstable" if current_network > 2000 * (prev_memory+1) else "Stable"
        else:
            result["network"] = "Unstable" if current_network <= 2000 * prev_network else "Stable"

    except Exception:
        result["cpu"] = "Stable"
        result["memory"] = "Stable"
        result
else:
    # If no previous data exists, treat the reading as baseline (stable)
    result["cpu"] = "Stable"
    result["memory"] = "Stable"
    result["network"] = "Stable"

# Save the current readings for the next comparison
current_data = {"cpu": current_cpu, "memory": current_memory, "network": current_network}
with open(prev_file, 'w') as pf:
    json.dump(current_data, pf)

# Output the result as JSON
print(json.dumps(result, indent=2))
