# launcher.py
# UC GAA Shot Tracker — Maya Launcher Bridge
# Receives shottracker:// URI from browser and launches Maya with correct file
# 
# Current state: PLACEHOLDER — logs URI and exits
# TODO: Full implementation in Phase 2

import sys
import os
import datetime

LOG_PATH = r"C:\Cincy\logs\launcher_log.txt"

def log(message):
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    with open(LOG_PATH, "a") as f:
        timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        f.write(f"[{timestamp}] {message}\n")

def main():
    if len(sys.argv) < 2:
        log("ERROR: No URI argument received")
        sys.exit(1)

    uri = sys.argv[1]
    log(f"URI received: {uri}")
    print(f"Shot Tracker launcher called with: {uri}")
    # TODO: parse URI, call Shot Tracker API, open Maya with correct file

if __name__ == "__main__":
    main()