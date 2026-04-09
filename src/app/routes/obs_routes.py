import requests
from flask import Blueprint, request, jsonify

obs_routes = Blueprint("obs_routes", __name__)

# 👇 Must be the OBS PC IP that worked in PowerShell
OBS_BRIDGE_URL = "http://172.20.1.66:5001"


@obs_routes.route("/obs/start", methods=["POST"])
def proxy_obs_start():
    try:
        payload = request.get_json(force=True)
        print("📤 Forwarding OBS start payload to bridge:", payload)

        resp = requests.post(f"{OBS_BRIDGE_URL}/obs/start", json=payload)
        print("📥 Bridge responded:", resp.status_code, resp.text)

        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        import traceback
        print("❌ Proxy OBS start error:", traceback.format_exc())
        return jsonify({"error": str(e), "error_id": "proxy_start"}), 500


@obs_routes.route("/obs/stop", methods=["POST"])
def proxy_obs_stop():
    try:
        print("📤 Forwarding OBS stop request to bridge...")
        resp = requests.post(f"{OBS_BRIDGE_URL}/obs/stop")
        print("📥 Bridge responded:", resp.status_code, resp.text)

        return jsonify(resp.json()), resp.status_code
    except Exception as e:
        import traceback
        print("❌ Proxy OBS stop error:", traceback.format_exc())
        return jsonify({"error": str(e), "error_id": "proxy_stop"}), 500
