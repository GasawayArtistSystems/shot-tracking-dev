from flask import Flask, request, jsonify
import asyncio
import simpleobsws
import os, sys, json, time
from datetime import date
from flask_cors import CORS
from pathlib import Path

app = Flask(__name__)
CORS(app, origins="*")

# --- CONFIG (safe for .py and PyInstaller) ---
print("### MARK: obs_bridge CLEAN BUILD ###")  # must appear when you run it

def _is_mei_path(p: str) -> bool:
    up = p.upper()
    return ("\\_MEI" in up) or ("/_MEI" in up)

def _app_dir() -> Path:
    # Folder of launched exe (or .py)
    return Path(sys.argv[0]).resolve().parent

def _localappdata_dir() -> Path:
    lad = os.getenv("LOCALAPPDATA") or os.getenv("APPDATA") or str(Path.home() / "AppData" / "Local")
    return Path(lad) / "Cincy" / "obs-bridge"

def _choose_cfg_path() -> Path:
    """
    Order:
      1) CWD ONLY if config.json exists and CWD is NOT a _MEI temp.
      2) App dir ONLY if config.json exists and app dir is NOT a _MEI temp.
      3) LocalAppData (create folder if needed).
    """
    # 1) CWD
    cwd = Path.cwd()
    if not _is_mei_path(str(cwd)):
        p = cwd / "config.json"
        if p.exists():
            return p

    # 2) App dir
    app_dir = _app_dir()
    if not _is_mei_path(str(app_dir)):
        p = app_dir / "config.json"
        if p.exists():
            return p

    # 3) LocalAppData
    la_dir = _localappdata_dir()
    la_dir.mkdir(parents=True, exist_ok=True)
    return la_dir / "config.json"

CFG_PATH = _choose_cfg_path()
print(f"[CFG] resolved CFG_PATH target: {CFG_PATH}")  # debug helper

DEFAULT_CFG = {
    "OBS_HOST": "127.0.0.1",
    "OBS_PORT": 4455,
    "OBS_PASSWORD": "changeme",
    "BRIDGE_HOST": "127.0.0.1",
    "BRIDGE_PORT": 5001,
    "REVIEWS_ROOT": str(Path.home() / "Videos" / "Reviews"),
}

# Load or create config (DO NOT crash if missing)
try:
    with open(CFG_PATH, "r", encoding="utf-8") as f:
        CFG = json.load(f)
except FileNotFoundError:
    try:
        os.makedirs(os.path.dirname(CFG_PATH), exist_ok=True)
        with open(CFG_PATH, "w", encoding="utf-8") as f:
            json.dump(DEFAULT_CFG, f, indent=2)
        print(f"[CFG] No config.json found. Wrote default to: {CFG_PATH}")
    except Exception as e:
        print(f"[CFG] Could not write default config ({e}). Using in-memory defaults.")
    CFG = DEFAULT_CFG
except Exception as e:
    print(f"[CFG] Error reading config ({e}). Using in-memory defaults.")
    CFG = DEFAULT_CFG

OBS_HOST     = CFG.get("OBS_HOST",     DEFAULT_CFG["OBS_HOST"])
OBS_PORT     = int(CFG.get("OBS_PORT", DEFAULT_CFG["OBS_PORT"]))
OBS_PASSWORD = CFG.get("OBS_PASSWORD", DEFAULT_CFG["OBS_PASSWORD"])
BRIDGE_HOST  = CFG.get("BRIDGE_HOST",  DEFAULT_CFG["BRIDGE_HOST"])
BRIDGE_PORT  = int(CFG.get("BRIDGE_PORT", DEFAULT_CFG["BRIDGE_PORT"]))
REVIEWS_ROOT = CFG.get("REVIEWS_ROOT", DEFAULT_CFG["REVIEWS_ROOT"])

print(f"[CFG] Using: {CFG_PATH}")
print(f"[CFG] OBS_HOST={OBS_HOST} OBS_PORT={OBS_PORT} BRIDGE_HOST={BRIDGE_HOST} BRIDGE_PORT={BRIDGE_PORT} REVIEWS_ROOT={REVIEWS_ROOT}")

# Cache info so stop can use assignment/student
last_record_info = {}



@app.route("/obs/start", methods=["POST"])
def start_obs_recording():
    try:
        data = request.get_json(force=True)
        print("📩 OBS Start received payload:", data)

        # normalize inputs
        assignment = (data.get("assignment") or "UnknownAssignment").strip().replace(" ", "_")
        student    = (data.get("student")    or "UnknownStudent").strip().replace(" ", "_")
        today_str  = date.today().isoformat()

        step = (data.get("step") or "").strip().upper()

        # 2) fallback: try to detect step code from assignment suffix, e.g. "Jump_BL"
        if not step:
            parts = assignment.split("_")
            # accept short alphabetic suffixes up to 3 chars as a step code
            if len(parts) > 1 and parts[-1].isalpha() and 1 <= len(parts[-1]) <= 3:
                step = parts[-1].upper()

        # 3) sanitize to allowed set (optional: extend as you add steps)
        ALLOWED_STEPS = {"PL", "BL", "BP", "P"}
        if step not in ALLOWED_STEPS:
            step = ""  # unknown/unset; we'll omit it in the final filename

        # cache info for /obs/stop
        global last_record_info
        last_record_info = {
            "assignment": assignment,
            "student":    student,
            "date":       today_str,
            "step":       step,   # "" if none
        }

        print(f"🧭 Cached start info → assignment={assignment}, student={student}, step={step or 'NONE'}, date={today_str}")


        review_dir = os.path.normpath(os.path.join(REVIEWS_ROOT, today_str))
        os.makedirs(review_dir, exist_ok=True)


        async def _start():
            ws = simpleobsws.WebSocketClient(
                url=f"ws://{OBS_HOST}:{OBS_PORT}",
                password=OBS_PASSWORD
            )
            await ws.connect()
            await ws.wait_until_identified()

            # Switch scene
            await ws.call(simpleobsws.Request("SetCurrentProgramScene", {"sceneName": "UC Critiques"}))

            # Set save directory
            await ws.call(simpleobsws.Request("SetRecordDirectory", {"recordDirectory": review_dir}))

            # Start recording
            resp = await ws.call(simpleobsws.Request("StartRecord"))
            await ws.disconnect()
            print("OBS response:", resp.responseData)

        asyncio.run(_start())

        return jsonify({
            "status": "recording started",
            "scene": "UC Critiques",
            "save_dir": review_dir
        })

    except Exception as e:
        import traceback
        print("❌ OBS start error:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500


@app.route("/obs/stop", methods=["POST"])
def stop_obs_recording():
    try:
        async def _stop():
            ws = simpleobsws.WebSocketClient(
                url=f"ws://{OBS_HOST}:{OBS_PORT}",
                password=OBS_PASSWORD
            )
            await ws.connect()
            await ws.wait_until_identified()
            resp = await ws.call(simpleobsws.Request("StopRecord"))
            await ws.disconnect()
            return resp.responseData

        resp_data = asyncio.run(_stop())
        print("OBS stop response:", resp_data)

        # 1) raw path from OBS (can be '.../.mp4')
        raw_output_path = (resp_data or {}).get("outputPath")

        # 2) pull cached info from /obs/start
        assignment = (last_record_info or {}).get("assignment", "UnknownAssignment")
        student    = (last_record_info or {}).get("student", "UnknownStudent")
        today_str  = (last_record_info or {}).get("date", date.today().isoformat())
        step_code  = (last_record_info or {}).get("step") or ""   # "", "BL", "BP", ...

        # 3) determine the actual source file to rename
        src_path = None
        if raw_output_path and os.path.exists(raw_output_path) and os.path.basename(raw_output_path) not in ("", ".mp4"):
            src_path = raw_output_path
            base_dir = os.path.dirname(raw_output_path)
        else:
            # fallback: pick newest mp4 in today's folder
            base_dir = os.path.join(REVIEWS_ROOT, today_str)
            try:
                candidates = [
                    os.path.join(base_dir, f)
                    for f in os.listdir(base_dir)
                    if f.lower().endswith(".mp4")
                ]
                src_path = max(candidates, key=os.path.getmtime) if candidates else None
                print(f"🧭 Fallback picked src_path={src_path}")
            except Exception as e:
                print(f"⚠️ Fallback listing failed for {base_dir}: {e}")
                src_path = None

        if not src_path or not os.path.exists(src_path):
            return jsonify({"error": "No output file found"}), 500

        # 4) build final filename: Assignment_Student[_STEP]_YYYY-MM-DD.mp4
        parts = [assignment, student]
        # allow only known short codes (extend if you add more)
        if step_code.upper() in {"PL", "BL", "BP", "P"}:
            parts.append(step_code.upper())
        parts.append(today_str)
        new_filename = "_".join(parts) + ".mp4"
        new_path = os.path.join(base_dir, new_filename)

        # 5) rename with retry (OBS may still be closing the file)
        saved_path = src_path
        for attempt in range(1, 6):
            try:
                if os.path.abspath(src_path) != os.path.abspath(new_path):
                    os.replace(src_path, new_path)  # atomic if same volume
                    saved_path = new_path
                print(f"✅ File renamed on attempt {attempt}: {saved_path}")
                break
            except PermissionError as e:
                print(f"⚠️ Rename attempt {attempt} failed: {e}")
                time.sleep(1)
            except Exception as e:
                print(f"⚠️ Rename attempt {attempt} failed: {e}")
                time.sleep(1)

        return jsonify({
            "status": "recording stopped",
            "saved_file_path": saved_path
        })

    except Exception as e:
        import traceback
        print("❌ OBS stop error:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500



if __name__ == "__main__":
    # Prefer waitress if available; otherwise fall back to Flask's server.
    try:
        from waitress import serve
        print("[INFO] Starting with waitress…")
        serve(app, host=BRIDGE_HOST, port=BRIDGE_PORT)
    except Exception as e:
        print(f"[INFO] Waitress not available ({e}). Falling back to Flask server…")
        app.run(host=BRIDGE_HOST, port=BRIDGE_PORT, debug=False, threaded=True)


