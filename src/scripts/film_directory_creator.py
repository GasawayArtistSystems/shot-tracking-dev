import os
import re
import json
import sys

CONFIG_PATH = r"C:/Cincy/Configs/film_config_v1.json"
OUTPUT_ROOT = r"C:/Films"

def safe_print(*args, **kwargs):
    try:
        print(*args, **kwargs)
    except UnicodeEncodeError:
        print(*[str(arg).encode("ascii", "replace").decode() for arg in args], **kwargs)

def sanitize_film_name(film_name):
    return re.sub(r"[^a-zA-Z0-9]+", "_", film_name).strip("_")

def get_next_version_file(path_without_version, extension):
    version = 1
    while True:
        file_name = f"{path_without_version}_v{version}.{extension}"
        if not os.path.exists(file_name):
            return file_name
        version += 1

def create_film_directory(film_id, config):
    film_data = config[film_id]
    film_title = film_data["title"]
    film_dir_name = film_title.replace("'", "")
    film_root = os.path.join(OUTPUT_ROOT, film_dir_name)

    os.makedirs(film_root, exist_ok=True)
    safe_print(f"Created main film directory: {film_root}")

    # Always create Thumbnails folder
    thumbnails_path = os.path.join(film_root, "Thumbnails")
    os.makedirs(thumbnails_path, exist_ok=True)

    scenes = film_data.get("scenes", {})

    if not isinstance(scenes, dict):
        safe_print(f"Skipping film {film_id}: 'scenes' is not a dict.")
        return

    for scene_id, scene_data in scenes.items():
        if scene_id == "default":
            continue

        valid_shots = []
        for shot in scene_data.get("shots", []):
            shot_number = (
                shot["number"] if isinstance(shot, dict) and "number" in shot
                else str(shot) if shot is not None
                else None
            )
            if shot_number:
                valid_shots.append(shot_number.zfill(3))

        if not valid_shots:
            
            continue

        scene_number = scene_data.get("scene_number", scene_id).zfill(3)
        scene_dir = os.path.join(film_root, scene_number)
        os.makedirs(scene_dir, exist_ok=True)

        for shot_number in valid_shots:
            shot_dir = os.path.join(scene_dir, shot_number)
            os.makedirs(shot_dir, exist_ok=True)

    for sub in ["Assets/Sets", "Assets/Rigs", "Assets/Props", "Assets/LightRigs", "Scripts", "Audio/Records", "Audio/SFX", "Audio/For Scenes", "Audio/For Shots"]:
        os.makedirs(os.path.join(film_root, sub), exist_ok=True)

    # ✅ Add Notes folder
    notes_path = os.path.join(film_root, "Notes")
    os.makedirs(notes_path, exist_ok=True)

        # ✅ Create individual asset folders from config
    assets_data = film_data.get("assets", {})
    if assets_data:
        assets_root = os.path.join(film_root, "Assets")
        os.makedirs(assets_root, exist_ok=True)

        for category, assets in assets_data.items():
            # Normalize the category (e.g. "Character/Rigs" → "Rigs")
            safe_cat = category.replace("/", "_").replace(" ", "_")
            category_dir = os.path.join(assets_root, safe_cat)
            os.makedirs(category_dir, exist_ok=True)

            for asset in assets:
                asset_name = asset.get("name")
                if not asset_name:
                    continue
                asset_path = os.path.join(category_dir, asset_name)
                if not os.path.exists(asset_path):
                    os.makedirs(asset_path)
                    safe_print(f"✅ Created asset folder: {asset_path}")
                else:
                    safe_print(f"🟡 Skipped existing asset: {asset_path}")


def main():
    with open(CONFIG_PATH, "r") as f:
        config = json.load(f)

    for film_id in config:
        try:
            create_film_directory(film_id, config)
        except Exception as e:
            safe_print(f"Error processing film {film_id}: {e}")

if __name__ == "__main__":
    main()




