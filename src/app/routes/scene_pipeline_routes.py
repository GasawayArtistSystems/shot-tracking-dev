from flask import Blueprint, request, jsonify, render_template
import os
import json
from app.database.db import get_db

scene_pipeline_bp = Blueprint("scene_pipeline", __name__)

CONFIG_PATH = "C:/Cincy/Configs/pipeline_config.json"


# -----------------------------------------------------------
# Utility
# -----------------------------------------------------------

def load_config():
    if not os.path.exists(CONFIG_PATH):
        return {
            "config_version": 2,
            "film": None,
            "asset_root": "\\\\GAAAP1PRD01W\\Films",
            "scenes": {}
        }

    with open(CONFIG_PATH, "r") as f:
        return json.load(f)


def save_config(data):
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)

    with open(CONFIG_PATH, "w") as f:
        json.dump(data, f, indent=2)


# -----------------------------------------------------------
# GET FULL CONFIG
# -----------------------------------------------------------

@scene_pipeline_bp.route("/pipeline/config", methods=["GET"])
def get_pipeline_config():
    config = load_config()
    return jsonify(config)


# -----------------------------------------------------------
# SET FILM
# -----------------------------------------------------------

@scene_pipeline_bp.route("/pipeline/config/set-film/<int:film_id>", methods=["POST"])
def set_pipeline_film(film_id):

    conn = get_db()

    film = conn.execute("""
        SELECT id, name
        FROM films
        WHERE id = ?
    """, (film_id,)).fetchone()

    if not film:
        return jsonify({"error": "Film not found"}), 404

    config = load_config()

    config["film"] = film["name"]

    save_config(config)

    return jsonify({
        "message": "Pipeline film set.",
        "film": film["name"]
    })


# -----------------------------------------------------------
# GET SCENES FROM DATABASE
# -----------------------------------------------------------

@scene_pipeline_bp.route("/pipeline/scenes/<int:film_id>", methods=["GET"])
def get_film_scenes(film_id):

    conn = get_db()

    scenes = conn.execute("""
        SELECT id, scene_number, description
        FROM scenes
        WHERE film_id = ?
        ORDER BY scene_number
    """, (film_id,)).fetchall()

    return jsonify([dict(row) for row in scenes])


# -----------------------------------------------------------
# UPDATE SCENE CONFIG
# -----------------------------------------------------------

@scene_pipeline_bp.route("/pipeline/scene/<int:film_id>/<scene_number>", methods=["POST"])
def update_scene_config(film_id, scene_number):

    data = request.get_json()

    if not data:
        return jsonify({"error": "Missing payload"}), 400

    config = load_config()

    film_id_str = str(film_id)

    if film_id_str not in config["films"]:
        config["films"][film_id_str] = {
            "film_name": None,
            "scenes": {}
        }

    film = config["films"][film_id_str]

    film["scenes"][scene_number] = {
        "set": data.get("set"),
        "rigs": data.get("rigs", []),
        "props": data.get("props", []),
        "light_rigs": data.get("light_rigs", []),
        "bgs": data.get("bgs", []),
        "camera_rigs": data.get("camera_rigs", [])
    }

    save_config(config)

    return jsonify({
        "message": f"Scene {scene_number} updated",
        "scene": film["scenes"][scene_number]
    })


# -----------------------------------------------------------
# GET SINGLE SCENE CONFIG
# -----------------------------------------------------------

@scene_pipeline_bp.route("/pipeline/scene/<int:film_id>/<scene_number>", methods=["GET"])
def get_scene_config(film_id, scene_number):

    config = load_config()

    film_id_str = str(film_id)

    if film_id_str not in config["films"]:
        return jsonify({"error": "Film not configured"}), 404

    film = config["films"][film_id_str]
    scenes = film.get("scenes", {})

    scene = scenes.get(scene_number)

    if not scene:
        return jsonify({"error": "Scene not configured"}), 404

    return jsonify(scene)


@scene_pipeline_bp.route("/pipeline/add-film/<int:film_id>", methods=["POST"])
def add_pipeline_film(film_id):

    conn = get_db()

    film = conn.execute("""
        SELECT id, name
        FROM films
        WHERE id = ?
    """, (film_id,)).fetchone()

    if not film:
        return jsonify({"error": "Film not found"}), 404

    config = load_config()

    film_id_str = str(film["id"])

    if film_id_str not in config["films"]:
        config["films"][film_id_str] = {
            "film_name": film["name"],
            "scenes": {}
        }

        save_config(config)

    return jsonify({
        "message": "Film added to pipeline config",
        "film_id": film["id"],
        "film_name": film["name"]
    })

# -----------------------------------------------------------
# GET AVAILABLE ASSETS FOR FILM
# -----------------------------------------------------------

@scene_pipeline_bp.route("/pipeline/assets/<int:film_id>", methods=["GET"])
def get_pipeline_assets(film_id):

    try:
        conn = get_db()

        rows = conn.execute("""
            SELECT name, category
            FROM assets
            WHERE film_id = ?
            ORDER BY category, name
        """, (film_id,)).fetchall()

        assets = {
            "sets": [],
            "rigs": [],
            "props": [],
            "light_rigs": [],
            "bgs": [],
            "camera_rigs": []
        }

        for row in rows:

            name = row["name"]
            category = row["category"].lower().strip()

            if "set" in category:
                assets["sets"].append(name)

            elif "rig" in category:
                assets["rigs"].append(name)

            elif "prop" in category:
                assets["props"].append(name)

            elif "light" in category:
                assets["light_rigs"].append(name)

            elif "bg" in category:
                assets["bgs"].append(name)

            elif "camera" in category:
                assets["camera_rigs"].append(name)

        return jsonify(assets)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
@scene_pipeline_bp.route("/pipeline/editor")
def scene_pipeline_editor():

    return render_template(
        "films/scene_pipeline.html"
    )
    
# -----------------------------------------------------------
# GET SCENE BUILD DATA FOR MAYA
# -----------------------------------------------------------

@scene_pipeline_bp.route("/pipeline/scene-build/<int:film_id>/<scene_number>", methods=["GET"])
def get_scene_build_data(film_id, scene_number):

    try:
        config = load_config()

        film_id_str = str(film_id)

        if film_id_str not in config["films"]:
            return jsonify({"error": "Film not found in pipeline config"}), 404

        film = config["films"][film_id_str]

        scenes = film.get("scenes", {})

        if scene_number not in scenes:
            return jsonify({"error": f"Scene {scene_number} not configured"}), 404

        scene = scenes[scene_number]

        result = {
            "film_id": film_id,
            "film_name": film.get("film_name"),
            "scene": scene_number,
            "set": scene.get("set"),
            "rigs": scene.get("rigs", []),
            "props": scene.get("props", []),
            "light_rigs": scene.get("light_rigs", []),
            "bgs": scene.get("bgs", []),
            "camera_rigs": scene.get("camera_rigs", [])
        }

        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
# -----------------------------------------------------------
# VALIDATE SCENE CONFIG
# -----------------------------------------------------------

@scene_pipeline_bp.route("/pipeline/validate-scene/<int:film_id>/<scene_number>", methods=["POST"])
def validate_scene_config(film_id, scene_number):

    try:

        config = load_config()
        film_id_str = str(film_id)

        if film_id_str not in config["films"]:
            return jsonify({"error": "Film not found in pipeline config"}), 404

        film = config["films"][film_id_str]
        scenes = film.get("scenes", {})

        if scene_number not in scenes:
            return jsonify({"error": f"Scene {scene_number} not configured"}), 404

        scene = scenes[scene_number]

        conn = get_db()

        errors = []

        def check_asset(name, category):

            row = conn.execute("""
                SELECT id
                FROM assets
                WHERE film_id = ?
                AND LOWER(TRIM(name)) = LOWER(TRIM(?))
                AND LOWER(TRIM(category)) LIKE LOWER(TRIM(?))
            """, (film_id, name, f"%{category}%")).fetchone()

            if not row:
                errors.append(f"{category} asset not found: {name}")


        # Validate set
        if scene.get("set"):
            check_asset(scene["set"], "set")

        # Validate rigs
        for rig in scene.get("rigs", []):
            check_asset(rig, "rig")

        # Validate props
        for prop in scene.get("props", []):
            check_asset(prop, "prop")

        # Validate light rigs
        for light in scene.get("light_rigs", []):
            check_asset(light, "light")

        # Validate bgs
        for bg in scene.get("bgs", []):
            check_asset(bg, "bg")

        # Validate camera rigs
        for cam in scene.get("camera_rigs", []):
            check_asset(cam, "camera")


        if errors:
            return jsonify({
                "valid": False,
                "errors": errors
            })

        return jsonify({
            "valid": True,
            "message": f"Scene {scene_number} config is valid."
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500