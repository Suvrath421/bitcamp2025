#!/bin/bash

# Check for URL and rule file arguments
if [ "$#" -ne 2 ]; then
  echo "Usage: $0 <URL> <YARA_RULE_FILE>"
  exit 1
fi

# Check if required commands exist
for cmd in wget yara; do
  if ! command -v $cmd &> /dev/null; then
    echo "Error: $cmd is required but not installed."
    exit 1
  fi
done

URL="$1"
RULE_FILE="$2"

# Verify rule file exists
if [ ! -f "$RULE_FILE" ]; then
  echo "Error: YARA rule file '$RULE_FILE' not found."
  exit 1
fi

# Create a temporary working directory
WORKDIR=$(mktemp -d -t site_scan_XXXX)
if [ $? -ne 0 ]; then
  echo "Error: Failed to create temporary directory"
  exit 1
fi
echo "Created temporary working directory: $WORKDIR"

# Download website code files
echo "Downloading website code from $URL..."
if ! wget --recursive --level=1 --no-parent --accept=html,js,css --directory-prefix="$WORKDIR" "$URL"; then
  echo "Error: Failed to download website content"
  rm -rf "$WORKDIR"
  exit 1
fi

# Run YARA scan
echo "Running YARA scan using rules defined in $RULE_FILE..."
SCAN_OUTPUT=$(yara -r "$RULE_FILE" "$WORKDIR" 2>&1)
YARA_EXIT=$?

if [ $YARA_EXIT -eq 0 ]; then
  if [ -n "$SCAN_OUTPUT" ]; then
    echo "Malicious patterns detected:"
    echo "$SCAN_OUTPUT"
  else
    echo "No malicious patterns were detected."
  fi
else
  echo "Error during YARA scan: $SCAN_OUTPUT"
fi

# Clean up
echo "Cleaning up..."
rm -rf "$WORKDIR"
echo "Scan completed."
exit $YARA_EXIT