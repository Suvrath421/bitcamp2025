if [ "$#" -eq 0 ]; then
    echo "Usage: $0 <your input>"
    exit 1
fi

# Access the first command-line argument
url="$1"

# Delete old
rm "/home/pi/Documents/out.csv"

python3 stats.py $url "out.csv"

echo "done"
cat /home/pi/Documents/out.csv

file="/home/pi/Documents/out.csv"

last_line=$(tail -n 1 "$file")

delimiter=","

IFS="$delimiter" read -ra fields <<< "$last_line"

if [ "${#fields[@]}" -ne 6 ]; then
    echo "Error: Expected 6 fields, but found ${#fields[@]}."
    exit 1
fi

# echo "Splitted fields:"
# echo "Field 1: ${fields[0]}"
# echo "Field 2: ${fields[1]}"
# echo "Field 3: ${fields[2]}"
# echo "Field 4: ${fields[3]}"
# echo "Field 5: ${fields[4]}"
# echo "Field 6: ${fields[5]}"

python3 z-test_script.py out.csv
