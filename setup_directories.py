import os

# ðŸ”¹ Change this when moving to the server
ROOT_DIRECTORY = "D:\\"
CLASSES_DIR = os.path.join(ROOT_DIRECTORY, "Classes")

# Film subdirectories
FILM_SUBDIRS = ["01_SB", "02_LAY", "03_AN", "04_LIGHT", "05_MOVIES"]

# Sample scenes for setup
SCENES = ["010", "020", "030"]


def create_directory(path):
    """Creates a directory if it does not exist."""
    if not os.path.exists(path):
        os.makedirs(path)
        print(f"Created: {path}")
    else:
        print(f"Exists: {path}")

def setup_classes():
    """Sets up the Classes directory and sample class structures."""
    create_directory(CLASSES_DIR)
    sample_classes = ["ClassName_001", "ClassName_002"]  # Example class names
    
    for class_name in sample_classes:
        class_path = os.path.join(CLASSES_DIR, class_name)
        create_directory(class_path)
        assignments_path = os.path.join(class_path, "Assignments")
        create_directory(assignments_path)

def setup_films():
    """Sets up the Films folder structure."""
    FILMS_DIR = os.path.join(ROOT_DIRECTORY, "Films")
    create_directory(FILMS_DIR)
    sample_film = "shortfilm"  # Example film name
    
    film_path = os.path.join(FILMS_DIR, sample_film)
    create_directory(film_path)
    
    for scene in SCENES:
        scene_path = os.path.join(film_path, scene)
        create_directory(scene_path)
        
        for subdir in FILM_SUBDIRS:
            create_directory(os.path.join(scene_path, subdir))

def main():
    """Runs the setup process."""
    setup_classes()
    setup_films()
    print("[OK]… Directory structure setup complete!")

if __name__ == "__main__":
    main()




