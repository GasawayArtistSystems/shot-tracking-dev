import os
import shutil
import re

FILMS_ROOT = r"\\GAAAP1PRD01W\Films"

for film in os.listdir(FILMS_ROOT):
    film_path = os.path.join(FILMS_ROOT, film)
    thumbs_root = os.path.join(film_path, "Thumbnails")
    reviewed_dir = os.path.join(thumbs_root, "Reviewed")

    if not os.path.isdir(thumbs_root):
        continue

    os.makedirs(reviewed_dir, exist_ok=True)

    for folder in os.listdir(thumbs_root):
        m = re.match(r"(\d{3})_(THUMB|SB)", folder, re.IGNORECASE)
        if not m:
            continue

        src_dir = os.path.join(thumbs_root, folder)
        if not os.path.isdir(src_dir):
            continue

        for f in os.listdir(src_dir):
            if not f.lower().endswith((".webm", ".mov", ".mp4")):
                continue

            src = os.path.join(src_dir, f)

            # ensure reviewed naming
            if "_r." not in f.lower():
                name, ext = os.path.splitext(f)
                dst_name = f"{name}_R{ext}"
            else:
                dst_name = f

            dst = os.path.join(reviewed_dir, dst_name)

            if not os.path.exists(dst):
                shutil.copy2(src, dst)
                print("COPIED:", dst)
