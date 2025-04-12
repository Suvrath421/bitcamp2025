# -*- coding: utf-8 -*-

import numpy as np
import sys
import csv
import json
from scipy.stats import norm

#print("Primary Dataframe Head:\n", df.head())

if len(sys.argv) > 1:
    filename = sys.argv[1]
    try:
        # Using DictReader to allow key-based access (e.g., 'cpu_delta', etc.)
        with open(filename, 'r') as file:
            df_input = list(csv.DictReader(file))
    except FileNotFoundError:
        #print(f"Error: The file '{filename}' was not found.")
        sys.exit(1)
    except Exception as e:
        #print(f"An error occurred: {e}")
        sys.exit(1)
else:
    #print("Usage: python input.py <filename.csv>")
    sys.exit(1)

# Convert the appropriate fields in df_input to numeric lists.
# Assuming the CSV columns are named correctly.
input_cpu = [float(row['cpu_delta']) for row in df_input]
input_memory = [float(row['memory_delta']) for row in df_input]
input_sent = [float(row['bytes_sent_delta']) for row in df_input]
input_recv = [float(row['bytes_recv_delta']) for row in df_input]
input_load = [float(row['full_load']) for row in df_input]

# Calculate the mean and standard deviation for each column (excluding 'domain')


sample_mean_cpu = 20.38625
sample_mean_memory = 1.7975
sample_mean_sent = 20222231.025
sample_mean_recv = 4561109.4125
sample_mean_load = 8.36055

sample_sd_cpu = 28.741087
sample_sd_memory = 1.342959
sample_sd_sent = 20677764.6160971
sample_sd_recv = 8365165.499534199
sample_sd_load = 6.17904987

# Print the results (optional)
#print("Means:\n", means)
#print("\nStandard Deviations:\n", stds)

alpha = 0.05  # Significance level

def one_sided_z_test(data_point, sample_mean, sample_sd):
    """Performs a one-sided z-test and checks for outliers.
    Returns a tuple of (is_outlier, z_score) with native Python types.
    """
    z_score = (data_point - sample_mean) / sample_sd
    p_value = 1 - norm.cdf(z_score)  # One-sided test
    return bool(p_value < alpha), float(z_score)

# Prepare dictionaries to collect results
results = {
    "cpu": [],
    "memory": [],
    "bytes_sent": [],
    "bytes_recv": [],
    "load": []
}

# CPU
#print("CPU Outlier Detection:")
for data in input_cpu:
    is_outlier, z_score = one_sided_z_test(data, sample_mean_cpu, sample_sd_cpu)
    results["cpu"].append({"value": float(data), "is_outlier": is_outlier, "z_score": z_score})
    #print(f"Value: {data}, Is Outlier: {is_outlier}, Z-score: {z_score}")

# Memory
#print("\nMemory Outlier Detection:")
for data in input_memory:
    is_outlier, z_score = one_sided_z_test(data, sample_mean_memory, sample_sd_memory)
    results["memory"].append({"value": float(data), "is_outlier": is_outlier, "z_score": z_score})
    #print(f"Value: {data}, Is Outlier: {is_outlier}, Z-score: {z_score}")

# Bytes Sent
#print("\nBytes Sent Outlier Detection:")
for data in input_sent:
    is_outlier, z_score = one_sided_z_test(data, sample_mean_sent, sample_sd_sent)
    results["bytes_sent"].append({"value": float(data), "is_outlier": is_outlier, "z_score": z_score})
    #print(f"Value: {data}, Is Outlier: {is_outlier}, Z-score: {z_score}")

# Bytes Received
#print("\nBytes Received Outlier Detection:")
for data in input_recv:
    is_outlier, z_score = one_sided_z_test(data, sample_mean_recv, sample_sd_recv)
    results["bytes_recv"].append({"value": float(data), "is_outlier": is_outlier, "z_score": z_score})
    #print(f"Value: {data}, Is Outlier: {is_outlier}, Z-score: {z_score}")

# Load
#print("\nLoad Outlier Detection:")
for data in input_load:
    is_outlier, z_score = one_sided_z_test(data, sample_mean_load, sample_sd_load)
    results["load"].append({"value": float(data), "is_outlier": is_outlier, "z_score": z_score})
    #print(f"Value: {data}, Is Outlier: {is_outlier}, Z-score: {z_score}")

# Return all results as a JSON object.
json_output = json.dumps(results, indent=2)
#print("\nFinal JSON Output:")
print(json_output)
