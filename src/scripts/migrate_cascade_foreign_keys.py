# migrate_schema_to_cascade.py

import sqlite3

DB_PATH = "app/database/app.db"  # Update path if needed

TABLE_REBUILDS = {
    "assignments": """
        CREATE TABLE assignments_new (
            id INTEGER PRIMARY KEY,
            class_id INTEGER,
            name TEXT,
            description TEXT,
            start_date TEXT,
            completion_date TEXT,
            archived INTEGER,
            parent_step_id INTEGER,
            progress_step_id INTEGER,
            FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
        );
    """,
    "class_enrollments": """
        CREATE TABLE class_enrollments_new (
            user_id INTEGER,
            class_id INTEGER,
            semester_id INTEGER,
            FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE
        );
    """,
    "individual_assignments": """
        CREATE TABLE individual_assignments_new (
            id INTEGER PRIMARY KEY,
            assignment_id INTEGER,
            users_id INTEGER,
            name TEXT,
            start_date TEXT,
            completion_date TEXT,
            archived INTEGER,
            file_path TEXT,
            video_status TEXT,
            FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE CASCADE
        );
    """,
    "individual_assignment_statuses": """
        CREATE TABLE individual_assignment_statuses_new (
            id INTEGER PRIMARY KEY,
            individual_assignment_id INTEGER,
            step_id INTEGER,
            current_status TEXT,
            annotations TEXT,
            FOREIGN KEY (individual_assignment_id) REFERENCES individual_assignments(id) ON DELETE CASCADE
        );
    """
}

MIGRATION_SEQUENCE = [
    "individual_assignment_statuses",
    "individual_assignments",
    "assignments",
    "class_enrollments"
]

def migrate():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys=OFF")
    cursor = conn.cursor()

    try:
        for table in MIGRATION_SEQUENCE:
            print(f"ðŸ›  Rebuilding {table} with CASCADE support...")
            cursor.executescript(TABLE_REBUILDS[table])
            cursor.execute(f"INSERT INTO {table}_new SELECT * FROM {table}")
            cursor.execute(f"DROP TABLE {table}")
            cursor.execute(f"ALTER TABLE {table}_new RENAME TO {table}")

        conn.commit()
        print("[OK] Migration complete.")
    except Exception as e:
        conn.rollback()
        print(f"âŒ Migration failed: {e}")
    finally:
        conn.execute("PRAGMA foreign_keys=ON")
        conn.close()

if __name__ == "__main__":
    migrate()



