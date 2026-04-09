# scripts/check_static_paths.py

import os
import re

TEMPLATE_DIR = "templates"
STATIC_DIR = "static"

static_pattern = re.compile(r"""url_for\(['"]static['"],\s*filename=['"]([^'"]+)['"]\)""")

def find_static_references():
    broken = []
    for root, _, files in os.walk(TEMPLATE_DIR):
        for file in files:
            if not file.endswith((".html", ".jinja2", ".j2")):
                continue
            full_path = os.path.join(root, file)
            with open(full_path, encoding="utf-8") as f:
                content = f.read()
                matches = static_pattern.findall(content)
                for match in matches:
                    static_path = os.path.join(STATIC_DIR, match)
                    if not os.path.exists(static_path):
                        broken.append((full_path, match))
    return broken

if __name__ == "__main__":
    missing = find_static_references()
    if not missing:
        print("[OK] All static file references are valid.")
    else:
        print("âŒ Missing static files found:")
        for template_path, missing_file in missing:
            print(f" - {template_path} â†’ static/{missing_file}")



