import json
import datetime
import os

def load_default_timelines():
    """Load the JSON with default durations/offsets."""
    config_path = os.path.join(os.path.dirname(__file__), "default_timelines.json")
    with open(config_path, "r") as f:
        return json.load(f)

def build_timeline(film_type, semester_start, finals_date, db=None, film_id=None):
    """
    Build a timeline for a film.
    - Prepro steps: pulled from DB (so dates match reality).
    - Assets: start after Locked_Script ends (parallel categories).
    - Production: seeded forward from semester_start based on JSON defaults.
    """

    defaults = load_default_timelines()
    if film_type not in defaults:
        raise ValueError(f"Unknown film type: {film_type}")

    prepro = []
    assets = []
    production = []

    # ---- Get Prepro from DB if available ----
    locked_script_end = None
    if db and film_id:
        rows = db.execute("""
            SELECT step_name, start_date, end_date
            FROM preproduction_steps
            WHERE film_id = ?
            ORDER BY id
        """, (film_id,)).fetchall()

        for r in rows:
            start_date = datetime.date.fromisoformat(r["start_date"]) if r["start_date"] else None
            end_date = datetime.date.fromisoformat(r["end_date"]) if r["end_date"] else None
            prepro.append({
                "step_name": r["step_name"],
                "start_date": start_date,
                "end_date": end_date
            })
            if r["step_name"] == "Locked_Script" and end_date:
                locked_script_end = end_date

    # ---- Assets (parallel after Locked_Script) ----
    if locked_script_end:
        start_date = locked_script_end
    elif prepro:
        start_date = prepro[-1]["end_date"]
    else:
        start_date = semester_start  # ultimate fallback

    categories = [
        ("Sets", 6),          # weeks
        ("BGs", 6),
        ("Characters/Rigs", 10),
        ("Props - 3D", 8),
        ("Props - 2D", 6),
        ("Light Rigs", 12),
    ]

    for cat_name, weeks in categories:
        days = weeks * 7
        end_date = start_date + datetime.timedelta(days=days)
        assets.append({
            "step_name": cat_name,
            "start_date": start_date,
            "end_date": end_date
        })

    # ---- Production (skip Assets + subs) ----
    for step_name, cfg in defaults[film_type].items():
        if step_name in [
            "Assets", "Sets", "BGs", "Characters/Rigs",
            "Props - 3D", "Props - 2D", "Light Rigs"
        ]:
            continue
        if step_name in ["Treatment", "Outline", "Script_Rough", "Script_Pass", "Locked_Script", "Voice_Record"]:
            continue  # handled by DB (prepro)

        duration_weeks = int(cfg.get("duration_weeks") or 1)
        duration_days = duration_weeks * 7
        offset_weeks = int(cfg.get("offset_weeks") or 0)
        offset_days = offset_weeks * 7
        fixed_to_finals = bool(cfg.get("fixed_to_finals") or False)

        start_date = semester_start + datetime.timedelta(days=offset_days)
        end_date = finals_date if fixed_to_finals else start_date + datetime.timedelta(days=duration_days)
        production.append({
            "step_name": step_name,
            "start_date": start_date,
            "end_date": end_date
        })

    return {
        "preproduction": prepro,
        "assets": assets,
        "production": production
    }

