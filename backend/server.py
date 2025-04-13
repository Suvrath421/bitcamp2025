import os
import re
import uuid
import time
import json
import math
import stat
import shutil
import hashlib
import subprocess
import requests
import threading
import datetime
from flask import Flask, request, jsonify
from pymongo import MongoClient
from bson import ObjectId

# Optional: ClamAV integration if pyclamd is installed
try:
    import pyclamd
    CLAMAV_AVAILABLE = True
except ImportError:
    CLAMAV_AVAILABLE = False

import yara
import pefile

# MongoDB connection (replace <db_password> and <dbname> with your actual values)
client = MongoClient("mongodb+srv://mitjaipp:Soccer12321@cluster0.gzuyvsh.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0")
db = client["data"]
jobs_collection = db["requests"]

# ---------- Global Settings and Setup ----------

app = Flask(__name__)

JOB_DIR = "/tmp/sandbox_jobs"
YARA_RULES_DIR = "/home/pi/Documents/downloader/yara_files"
os.makedirs(JOB_DIR, exist_ok=True)

VT_API_KEY = "1d6e7e6019ce33305ffca2d031ae315f81d9ae04e11388409322b266a9c62248"

VT_CACHE = {}

def check_virustotal(sha256_hash, api_key):
    if sha256_hash in VT_CACHE:
        return VT_CACHE[sha256_hash]
    
    url = f"https://www.virustotal.com/api/v3/files/{sha256_hash}"
    headers = {"x-apikey": api_key}
    try:
        response = requests.get(url, headers=headers, timeout=10)
        if response.status_code == 200:
            data = response.json()
            stats = data["data"]["attributes"]["last_analysis_stats"]
            result = {
                "malicious": stats.get("malicious", 0),
                "suspicious": stats.get("suspicious", 0),
                "harmless": stats.get("harmless", 0),
                "undetected": stats.get("undetected", 0),
                "reputation": data["data"]["attributes"].get("reputation", 0),
                "engine_results": {
                    k: v["category"]
                    for k, v in data["data"]["attributes"]["last_analysis_results"].items()
                    if v["category"] in {"malicious", "suspicious"}
                }
            }
            VT_CACHE[sha256_hash] = result
            return result
        else:
            error_result = {"error": f"VT lookup failed: HTTP {response.status_code}"}
            VT_CACHE[sha256_hash] = error_result
            return error_result
    except Exception as e:
        error_result = {"error": f"VT exception: {str(e)}"}
        VT_CACHE[sha256_hash] = error_result
        return error_result

def compile_yara_rules(directory):
    rule_files = {}
    for root, _, files in os.walk(directory):
        for file in files:
            if file.endswith((".yar", ".yara")):
                full_path = os.path.join(root, file)
                try:
                    yara.compile(filepath=full_path)
                    namespace = os.path.splitext(file)[0]
                    rule_files[namespace] = full_path
                except yara.SyntaxError as e:
                    print(f"[!] Skipping {file} due to syntax error: {e}")
    if not rule_files:
        return None
    return yara.compile(filepaths=rule_files)

YARA_RULES = compile_yara_rules(YARA_RULES_DIR)

def compute_sha256(file_path):
    hash_sha256 = hashlib.sha256()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_sha256.update(chunk)
    return hash_sha256.hexdigest()

def file_cmd(file_path):
    try:
        proc = subprocess.run(["file", file_path], capture_output=True, text=True, timeout=5)
        return proc.stdout.lower().strip()
    except Exception as e:
        return f"error: {str(e)}"

def run_yara(file_path):
    if not YARA_RULES:
        return ["No YARA rules loaded."]
    try:
        matches = YARA_RULES.match(file_path)
        return [match.rule for match in matches] if matches else ["No matches"]
    except Exception as e:
        return [f"YARA scan error: {str(e)}"]

def clamav_scan(file_path):
    if not CLAMAV_AVAILABLE:
        return "ClamAV not available"
    try:
        # Using Unix socket for ClamAV (no TCP)
        cd = pyclamd.ClamdUnixSocket()
        if not cd.ping():
            return "ClamAV daemon not responding on Unix socket"
        scan_result = cd.scan_file(file_path)
        return f"ClamAV detection: {scan_result.get(file_path)}" if scan_result else "No virus found by ClamAV"
    except Exception as e:
        return f"ClamAV scan error: {str(e)}"

def remove_executable_permission(file_path):
    try:
        st = os.stat(file_path)
        os.chmod(file_path, st.st_mode & ~stat.S_IEXEC & ~stat.S_IXGRP & ~stat.S_IXOTH)
    except:
        pass

def safe_join(base, *paths):
    final_path = os.path.realpath(os.path.join(base, *paths))
    if not final_path.startswith(os.path.realpath(base)):
        raise ValueError("Attempted Path Traversal in safe_join")
    return final_path

def handle_archive_recursively(analysis_result, file_path, extract_root, depth=0, max_depth=3):
    if depth > max_depth:
        analysis_result["warnings"].append(f"Exceeded max archive depth ({max_depth})")
        return

    ftype = file_cmd(file_path)
    analysis_result["details"].append({"file": file_path, "file_type": ftype})

    if any(x in ftype for x in ["7-zip archive", "zip archive", "rar archive", "tar archive"]):
        sub_extract_dir = safe_join(extract_root, f"nested_{depth}")
        os.makedirs(sub_extract_dir, exist_ok=True)

        proc = subprocess.run(
            ["7z", "x", file_path, f"-o{sub_extract_dir}", "-y"],
            capture_output=True, text=True
        )
        if proc.returncode != 0:
            analysis_result["warnings"].append(f"7z extraction failed for {file_path}: {proc.stderr}")
        else:
            for root, dirs, files in os.walk(sub_extract_dir):
                for fname in files:
                    fpath = os.path.join(root, fname)
                    remove_executable_permission(fpath)
                    handle_archive_recursively(analysis_result, fpath, sub_extract_dir, depth+1, max_depth)

# --- Additional Static Analysis Functions ---
def calculate_entropy(data):
    if not data:
        return 0.0
    freq = {}
    for byte in data:
        freq[byte] = freq.get(byte, 0) + 1
    entropy = 0.0
    length = len(data)
    for count in freq.values():
        p = count / length
        entropy -= p * math.log2(p)
    return round(entropy, 2)

def compute_file_entropy(file_path):
    try:
        with open(file_path, "rb") as f:
            data = f.read()
        return calculate_entropy(data)
    except Exception as e:
        return None

def analyze_suspicious_strings(file_path):
    """
    Scans the file for suspicious keywords and returns a weighted score.
    """
    score = 0
    patterns = {
        "eval": 2,
        "base64": 2,
        "powershell": 3,
        "cmd.exe": 3,
        "exec": 2,
        "wget": 1,
        "curl": 1,
        "createremotethread": 2,  # For PE files, appears as string as well.
    }
    try:
        with open(file_path, "rb") as f:
            data = f.read()
        text = data.decode("latin-1", errors="ignore").lower()
        for patt, weight in patterns.items():
            if patt in text:
                score += weight
        return score
    except Exception as e:
        return 0

# --- PE Analysis ---
def analyze_pe_file(file_path, analysis_result):
    suspicious_imports = {b"CreateRemoteThread", b"VirtualAlloc", b"WriteProcessMemory",
                          b"WinExec", b"ShellExecuteA", b"ShellExecuteW"}
    try:
        pe = pefile.PE(file_path)
        pe_info = {"high_entropy_sections": [], "suspicious_imports": []}
        for section in pe.sections:
            data = section.get_data()
            if not data:
                continue
            freq = {}
            for b in data:
                freq[b] = freq.get(b, 0) + 1
            entropy = 0.0
            length = len(data)
            for c, cnt in freq.items():
                p = cnt / length
                entropy -= p * math.log2(p)
            if entropy > 7.0:
                pe_info["high_entropy_sections"].append(section.Name.decode().strip('\x00'))
        if hasattr(pe, 'DIRECTORY_ENTRY_IMPORT'):
            for entry in pe.DIRECTORY_ENTRY_IMPORT:
                for imp in entry.imports:
                    if imp.name in suspicious_imports:
                        pe_info["suspicious_imports"].append(imp.name.decode())
        analysis_result["pe_analysis"] = pe_info
    except Exception as e:
        analysis_result["pe_analysis"] = f"PE parse error: {str(e)}"

def extract_iocs_strings(file_path, analysis_result):
    try:
        with open(file_path, "rb") as f:
            raw_data = f.read()
        text_data = raw_data.decode("latin-1", errors="ignore")

        domain_pattern = re.compile(r"[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
        ip_pattern = re.compile(r"(?:\d{1,3}\.){3}\d{1,3}")
        file_path_pattern = re.compile(r"(?:[A-Za-z]:\\[^\s]+)|(?:/[^\s]+)")

        domains = set(domain_pattern.findall(text_data))
        ips = set(ip_pattern.findall(text_data))
        paths = set(file_path_pattern.findall(text_data))

        filtered_domains = [d for d in domains if "." in d and len(d) > 3]
        filtered_ips = [ip for ip in ips if len(ip.split(".")) == 4]

        iocs = {
            "domains": list(filtered_domains),
            "ips": list(filtered_ips),
            "file_paths": list(paths),
        }
        analysis_result["iocs"] = iocs
    except Exception as e:
        analysis_result["warnings"].append(f"IOC extraction error: {str(e)}")

# ---------- Job Workflow Functions ----------

def store_job(job_data):
    result = jobs_collection.insert_one(job_data)
    return str(result.inserted_id)

def get_job(job_id):
    job = jobs_collection.find_one({"_id": ObjectId(job_id)})
    if job:
        job["_id"] = str(job["_id"])
    return job

def update_job(job_id, updates):
    jobs_collection.update_one({"_id": ObjectId(job_id)}, {"$set": updates})

# ---------- Analysis Functions for the Worker ----------

def perform_analysis(url):
    if not url:
        return jsonify({"error": "Missing 'url' field"}), 400

    job_id = str(uuid.uuid4())
    file_path = os.path.join(JOB_DIR, job_id)
    extract_dir = os.path.join(JOB_DIR, f"{job_id}_extract")
    os.makedirs(extract_dir, exist_ok=True)

    analysis_result = {
        "job_id": job_id,
        "file_url": url,
        "download_success": False,
        "sha256": None,
        "file_type": None,
        "file_entropy": None,
        "yara_matches": None,
        "clamav_scan": None,
        "pe_analysis": None,
        "iocs": {},
        "suspicion_score": 0,
        "suspicion_level": "Unknown",
        "warnings": [],
        "details": [],
    }

    try:
        r = requests.get(url, timeout=10)
        if r.status_code != 200:
            analysis_result["error"] = f"Failed to download file: HTTP {r.status_code}"
            return analysis_result

        with open(file_path, "wb") as f:
            f.write(r.content)
        analysis_result["download_success"] = True

        sha256_hash = compute_sha256(file_path)
        analysis_result["sha256"] = sha256_hash
        # Uncomment the next line to enable VirusTotal lookup if desired:
        analysis_result["virustotal"] = "skipped" if not use_virus_total else check_virustotal(sha256_hash, VT_API_KEY)
    
        ftype = file_cmd(file_path)
        analysis_result["file_type"] = ftype

        analysis_result["yara_matches"] = run_yara(file_path)
        analysis_result["clamav_scan"] = clamav_scan(file_path)
        remove_executable_permission(file_path)

        if "pe32" in ftype or "pe64" in ftype or "ms windows pe" in ftype:
            analyze_pe_file(file_path, analysis_result)

        extract_iocs_strings(file_path, analysis_result)

        if any(x in ftype for x in ["7-zip archive", "zip archive", "rar archive", "tar archive", "compressed data"]):
            handle_archive_recursively(analysis_result, file_path, extract_dir, depth=0, max_depth=3)

        if "debian binary package" in ftype:
            dpkg_extract_dir = os.path.join(JOB_DIR, f"{job_id}_deb_extract")
            os.makedirs(dpkg_extract_dir, exist_ok=True)
            proc = subprocess.run(["dpkg-deb", "-x", file_path, dpkg_extract_dir],
                                  capture_output=True, text=True)
            if proc.returncode != 0:
                analysis_result["warnings"].append(f"dpkg-deb extraction failed: {proc.stderr}")

        entropy = compute_file_entropy(file_path)
        analysis_result["file_entropy"] = entropy

        suspicious_strings_score = analyze_suspicious_strings(file_path)

        suspicion_score = 0
        if entropy is not None and entropy >= 7.5:
            suspicion_score += 5
        if analysis_result["yara_matches"] and "No matches" not in analysis_result["yara_matches"]:
            suspicion_score += 5
        if isinstance(analysis_result.get("pe_analysis"), dict):
            if analysis_result["pe_analysis"].get("suspicious_imports"):
                suspicion_score += 5
        suspicion_score += suspicious_strings_score

        analysis_result["suspicion_score"] = suspicion_score
        if suspicion_score >= 15:
            analysis_result["suspicion_level"] = "High"
        elif suspicion_score >= 8:
            analysis_result["suspicion_level"] = "Medium"
        elif suspicion_score > 0:
            analysis_result["suspicion_level"] = "Low"
        else:
            analysis_result["suspicion_level"] = "Unknown"

    except Exception as e:
        analysis_result["error"] = str(e)

    return analysis_result

# --- Flask Endpoint ---
def perform_ztest(url):
    if not url:
        return {"error": "Missing 'url' field"}
    
    sp = subprocess.run(["bash", "hyp_test.sh", url], capture_output=True,  text=True)
    if sp.returncode != 0:
        print("bash failed", sp.stderr)

    with open("z-test.json", "r") as file:
        data = json.load(file)

    return data

# def perform_ztest(url):
#     sp = subprocess.run(["bash", "hyp_test.sh", url], capture_output=True,  text=True)
#     if sp.returncode != 0:
#         return {"error": f"bash failed: {sp.stderr}"}
#     try:
#         with open("z-test.json", "r") as file:
#             data = json.load(file)
#         return data
#     except Exception as e:
#         return {"error": f"Failed to load z-test result: {str(e)}"}

# def perform_scanpage(url):
#     rules = "rules.yar"
#     sp = subprocess.run(["bash", "scan_site.sh", url, rules], capture_output=True, text=True)
#     if sp.returncode != 0:
#         return {"error": sp.stderr}
#     return {"message": "Scan successful", "output": sp.stdout}

def perform_scanpage(url):
    rules = "rules.yar"
    if not url:
        return {"error": "Missing 'url' field"}

    sp = subprocess.run(["bash", "scan_site.sh", url, rules], capture_output=True, text=True)
    if sp.returncode != 0:
        return {"error": sp.stderr}, 500

    return {"message": "Scan successful", "output": sp.stdout }

# ---------- REST API Endpoints for Job Submission ----------

@app.route("/analyze", methods=["POST"])
def analyze_endpoint():
    data = request.get_json()
    url = data.get("url")
    if not url:
        return jsonify({"error": "Missing 'url' field"}), 400
    job_data = {
        "job_id": str(uuid.uuid4()),
        "endpoint": "analyze",
        "url": url,
        "status": "pending",
        "result": None,
        "created_at": time.time()
    }
    job_id = store_job(job_data)
    return jsonify({"success": True, "job_id": job_id}), 202

@app.route("/ztest", methods=["POST"])
def ztest_endpoint():
    data = request.get_json()
    url = data.get("url")
    if not url:
        return jsonify({"error": "Missing 'url' field"}), 400
    job_data = {
        "job_id": str(uuid.uuid4()),
        "endpoint": "ztest",
        "url": url,
        "status": "pending",
        "result": None,
        "created_at": time.time()
    }
    job_id = store_job(job_data)
    return jsonify({"success": True, "job_id": job_id}), 202

@app.route("/scanpage", methods=["POST"])
def scanpage_endpoint():
    data = request.get_json()
    url = data.get("url")
    if not url:
        return jsonify({"error": "Missing 'url' field"}), 400
    job_data = {
        "job_id": str(uuid.uuid4()),
        "endpoint": "scanpage",
        "url": url,
        "status": "pending",
        "result": None,
        "created_at": time.time()
    }
    job_id = store_job(job_data)
    return jsonify({"success": True, "job_id": job_id}), 202

@app.route("/job/<job_id>", methods=["GET"])
def job_status(job_id):
    job = get_job(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    return jsonify({"success": True, "job": job}), 200

# ---------- Background Worker to Process Jobs ----------

def process_job(job):
    endpoint = job.get("endpoint")
    url = job.get("url")
    if endpoint == "analyze":
        return perform_analysis(url)
    elif endpoint == "ztest":
        return perform_ztest(url)
    elif endpoint == "scanpage":
        return perform_scanpage(url)
    else:
        return {"error": f"Unknown endpoint: {endpoint}"}

def job_worker():
    while True:
        pending_job = jobs_collection.find_one({"status": "pending"})
        if pending_job:
            result = process_job(pending_job)
            update_job(str(pending_job["_id"]), {
                "status": "processed",
                "result": result,
                "processed_at": datetime.datetime.now().isoformat()
            })
        time.sleep(5)

# ---------- Main Application Runner ----------

if __name__ == "__main__":
    worker_thread = threading.Thread(target=job_worker, daemon=True)
    worker_thread.start()
    app.run(host="0.0.0.0", port=8080)
