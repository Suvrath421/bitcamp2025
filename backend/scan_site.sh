#!/bin/bash
# Check for URL and rule file arguments
if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <URL> <YARA_RULE_FILE>"
  exit 1
fi

URL="$1"
RULE_FILE="$2"

# Create a temporary working directory
WORKDIR=$(mktemp -d -t site_scan_XXXX)
echo "Created temporary working directory: $WORKDIR"

# Download website code files:
# --recursive: download linked pages
# --level=1: limit recursion depth to 1 (adjust as needed)
# --no-parent: don't ascend to parent directories
# --accept: only download HTML, JS and CSS files
# --directory-prefix: save files to the working directory
echo "Downloading website code from $URL..."
wget --recursive --level=1 --no-parent --accept=html,js,css --directory-prefix="$WORKDIR" "$URL"

# Run YARA scan against the downloaded files and capture its output
echo "Running YARA scan using rules defined in $RULE_FILE..."
SCAN_OUTPUT=$(yara -r "$RULE_FILE" "$WORKDIR")

# Check the output: if not empty, there were matches
if [ -n "$SCAN_OUTPUT" ]; then
  echo "Malicious patterns detected:"
  echo "$SCAN_OUTPUT"
else
  echo "No malicious patterns were detected."
fi

# Clean up: remove the temporary working directory
echo "Cleaning up..."
rm -rf "$WORKDIR"
echo "Scan completed."
