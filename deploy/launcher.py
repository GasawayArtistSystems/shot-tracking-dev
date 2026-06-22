# launcher.py
# UC GAA Shot Tracker — Maya Launcher Bridge
# Receives shottracker:// URI from Windows registry and opens Maya
# with the correct student file for the given assignment.
#
# URI format: shottracker://open?assignment_id=84&class_id=12&username=caratinl

import sys
import os
import json
import datetime
import subprocess
import urllib.parse
import requests

# ── Config ────────────────────────────────────────────────────
SHOT_TRACKER_URL = "http://10.23.20.210:8000"
MAYA_EXE         = r"C:\Program Files\Autodesk\Maya2026\bin\maya.exe"
LOG_PATH         = r"C:\Cincy\logs\launcher_log.txt"
MAYA_SCRIPT_PATH = r"C:\Cincy\scripts"

# ── Logging ───────────────────────────────────────────────────
def log(message):
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(LOG_PATH, "a") as f:
        f.write(f"[{timestamp}] {message}\n")
    print(f"[{timestamp}] {message}")

# ── URI Parsing ───────────────────────────────────────────────
def parse_uri(uri):
    """
    Parse shottracker://open?assignment_id=84&class_id=12&username=caratinl
    Returns dict of params or None on failure.
    """
    try:
        # Strip the scheme
        uri = uri.replace("shottracker://", "http://localhost/")
        parsed = urllib.parse.urlparse(uri)
        params = urllib.parse.parse_qs(parsed.query)
        return {k: v[0] for k, v in params.items()}
    except Exception as e:
        log(f"ERROR parsing URI: {e}")
        return None

# ── Shot Tracker API ──────────────────────────────────────────
def get_assignment_config(assignment_id, username):
    """
    Calls Shot Tracker API and returns assignment config dict.
    """
    try:
        url = f"{SHOT_TRACKER_URL}/classes/api/launcher/assignment-config"
        r = requests.get(url, params={
            "assignment_id": assignment_id,
            "username": username
        }, timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        log(f"ERROR fetching assignment config: {e}")
        return None

# ── File Resolution ───────────────────────────────────────────
def resolve_student_file(config):
    """
    Checks if a student file exists for this assignment.
    Returns the file path if found, None if this is a new file.
    
    Naming convention: AssignmentName_username_BL_V001.ma
    Looks for highest version of current step.
    """
    save_path = config["save_path"]
    assignment_name = config["assignment_name"].replace(" ", "")
    username = config["username"]

    if not os.path.isdir(save_path):
        log(f"Save path doesn't exist yet: {save_path}")
        return None

    # Look for existing files matching this assignment
    import re
    pattern = re.compile(
        rf"^{re.escape(assignment_name)}_{re.escape(username)}_([A-Z]+)_V(\d+)\.ma$",
        re.IGNORECASE
    )

    matches = []
    for f in os.listdir(save_path):
        m = pattern.match(f)
        if m:
            matches.append((f, m.group(1), int(m.group(2))))

    if not matches:
        log("No existing file found — will create new.")
        return None

    # Sort by version descending, return latest
    matches.sort(key=lambda x: x[2], reverse=True)
    latest = matches[0][0]
    full_path = os.path.join(save_path, latest)
    log(f"Found existing file: {full_path}")
    return full_path

# ── MEL Script Builder ────────────────────────────────────────
def build_mel_script(config, existing_file):
    """
    Builds a MEL script that Maya executes on launch.
    Handles both new file creation and existing file opening.
    """
    save_path    = config["save_path"].replace("\\", "\\\\")
    assignment   = config["assignment_name"].replace(" ", "")
    username     = config["username"]
    frame_start  = config["frame_start"]
    frame_end    = config["frame_end"]
    camera       = config["camera"]
    rigs         = config["rigs"]

    lines = []

    if existing_file:
        # Open existing file
        safe_path = existing_file.replace("\\", "\\\\")
        lines.append(f'file -force -open "{safe_path}";')
        lines.append(f'print "Opened existing file: {safe_path}\\n";')
    else:
        # New file — set up scene from scratch
        lines.append('file -force -new;')

        # Create save directory if needed
        lines.append(f'sysFile -makeDir "{save_path}";')

        # Load rigs
        for rig in rigs:
            rig_path = rig.get("path", "").replace("\\", "\\\\")
            if rig_path:
                lines.append(f'file -import -type "mayaBinary" -mergeNamespacesOnClash true "{rig_path}";')
                lines.append(f'print "Loaded rig: {rig_path}\\n";')

        # Add camera if needed
        if camera:
            lines.append('camera -centerOfInterest 5 -focalLength 35 -name "renderCam";')
            lines.append('print "Camera added\\n";')

        # Save new file as V001 at BL step
        new_filename = f"{assignment}_{username}_BL_V001.ma"
        new_filepath = f"{save_path}\\\\{new_filename}"
        lines.append(f'file -rename "{new_filepath}";')
        lines.append(f'file -save -type "mayaAscii";')
        lines.append(f'print "Saved new file: {new_filepath}\\n";')

    # Set frame range
    lines.append(f'playbackOptions -min {frame_start} -max {frame_end} -animationStartTime {frame_start} -animationEndTime {frame_end};')
    lines.append(f'print "Frame range set: {frame_start}-{frame_end}\\n";')
    lines.append('print "Shot Tracker launch complete\\n";')

    return "\n".join(lines)

# ── Maya Launch ───────────────────────────────────────────────
def launch_maya(mel_script):
    """
    Writes MEL script to a temp file and launches Maya with it.
    """
    mel_path = r"C:\Cincy\logs\launch_script.mel"
    os.makedirs(os.path.dirname(mel_path), exist_ok=True)

    with open(mel_path, "w") as f:
        f.write(mel_script)

    log(f"MEL script written to: {mel_path}")
    log(f"Launching Maya: {MAYA_EXE}")

    subprocess.Popen([
        MAYA_EXE,
        "-script", mel_path
    ])

# ── Main ──────────────────────────────────────────────────────
def main():
    log("=" * 50)
    log("Shot Tracker Launcher started")

    if len(sys.argv) < 2:
        log("ERROR: No URI argument received")
        sys.exit(1)

    uri = sys.argv[1]
    log(f"URI received: {uri}")

    # Parse URI
    params = parse_uri(uri)
    if not params:
        log("ERROR: Could not parse URI")
        sys.exit(1)

    assignment_id = params.get("assignment_id")
    username      = params.get("username")

    if not assignment_id or not username:
        log("ERROR: Missing assignment_id or username in URI")
        sys.exit(1)

    log(f"assignment_id={assignment_id} username={username}")

    # Get config from Shot Tracker
    config = get_assignment_config(assignment_id, username)
    if not config:
        log("ERROR: Could not get assignment config from Shot Tracker")
        sys.exit(1)

    log(f"Config received: {json.dumps(config)}")

    # Check for existing file
    existing_file = resolve_student_file(config)

    # Build MEL script
    mel_script = build_mel_script(config, existing_file)
    log(f"MEL script built")

    # Launch Maya
    launch_maya(mel_script)
    log("Maya launch initiated")

if __name__ == "__main__":
    main()