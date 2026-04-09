import os
import json

# ðŸ”¹ Change this when moving to the server
ROOT_DIRECTORY = "D:\\"
ASSIGNMENTS_DIR = os.path.join(ROOT_DIRECTORY, "Assignments")
FILMS_DIR = os.path.join(ROOT_DIRECTORY, "Films")

def parse_filename(filename):
    """Parses filename to extract name, user, version, and review status."""
    parts = filename.rsplit("_", maxsplit=2)
    if len(parts) < 3:
        return None  # Skip invalid files
    
    name, user, version = parts
    reviewed = version.endswith("_R")
    version = version.replace("_R", "")
    
    return {
        "name": name,
        "user": user,
        "version": version,
        "reviewed": reviewed,
        "filename": filename
    }

def scan_assignments():
    """Scans the Assignments directory and detects assignment files."""
    assignments = []
    if not os.path.exists(ASSIGNMENTS_DIR):
        return assignments
    
    for folder in os.listdir(ASSIGNMENTS_DIR):
        folder_path = os.path.join(ASSIGNMENTS_DIR, folder)
        if os.path.isdir(folder_path):
            for file in os.listdir(folder_path):
                parsed = parse_filename(file)
                if parsed:
                    assignments.append(parsed)
    
    return assignments

def scan_films():
    """Scans the Films directory, detecting scenes, shots, and versions."""
    films = []
    if not os.path.exists(FILMS_DIR):
        return films
    
    for film in os.listdir(FILMS_DIR):
        film_path = os.path.join(FILMS_DIR, film)
        if os.path.isdir(film_path):
            for scene in os.listdir(film_path):
                scene_path = os.path.join(film_path, scene)
                if os.path.isdir(scene_path):
                    for step in os.listdir(scene_path):
                        step_path = os.path.join(scene_path, step)
                        if os.path.isdir(step_path):
                            for file in os.listdir(step_path):
                                parts = file.split("_")
                                if len(parts) < 4:
                                    continue  # Invalid file format
                                
                                scene_num, shot_num, step_code, version = parts
                                reviewed = version.endswith("_R")
                                version = version.replace("_R", "")
                                
                                films.append({
                                    "film": film,
                                    "scene": scene_num,
                                    "shot": shot_num,
                                    "step": step_code,
                                    "version": version,
                                    "reviewed": reviewed,
                                    "filename": file
                                })
    return films

def main():
    """Runs the file scanning process."""
    data = {
        "assignments": scan_assignments(),
        "films": scan_films()
    }
    
    with open("file_scan_output.json", "w") as f:
        json.dump(data, f, indent=4)
    
    print("File scan complete. Results saved to file_scan_output.json")

if __name__ == "__main__":
    main()




