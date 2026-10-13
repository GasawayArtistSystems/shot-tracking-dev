# migrate_add_assignment_xsheet_enabled.py
# Adds an xsheet_enabled flag to assignments so an instructor can offer the
# X-sheet as an optional tool on assignments whose workflow has no Planning
# step (e.g. the Intermediate Talker) -- it isn't part of the assignment or
# its grade, just available to students who want it. Planning-step
# assignments get the X-sheet regardless of this flag.
#
# Also turns the flag on for any existing "Talker" assignment in an
# Intermediate class, since that's what prompted it. Anything else is
# toggled from the New/Edit Assignment forms.
#
# Run once (from any folder -- the DB path is resolved from this file):
#   python src/scripts/migrate_add_assignment_xsheet_enabled.py

import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app", "database", "app.db")


def migrate():
    # sqlite3.connect would silently create an empty DB at a wrong path.
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {os.path.abspath(DB_PATH)}")
        return
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    existing_cols = {row[1] for row in cursor.execute("PRAGMA table_info(assignments)")}

    try:
        if "xsheet_enabled" not in existing_cols:
            print("Adding xsheet_enabled column...")
            cursor.execute("ALTER TABLE assignments ADD COLUMN xsheet_enabled INTEGER NOT NULL DEFAULT 0")
        else:
            print("xsheet_enabled already exists, skipping.")

        talkers = cursor.execute("""
            SELECT a.id, a.name, c.class_name
            FROM assignments a
            JOIN classes c ON a.class_id = c.id
            WHERE a.name LIKE '%talker%' AND c.class_name LIKE '%intermediate%'
        """).fetchall()
        for assignment_id, name, class_name in talkers:
            print(f"Enabling optional X-sheet on '{name}' ({class_name})...")
            cursor.execute("UPDATE assignments SET xsheet_enabled = 1 WHERE id = ?", (assignment_id,))
        if not talkers:
            print("No Intermediate Talker assignment found -- enable it from Edit Assignment instead.")

        conn.commit()
        print("Migration complete.")
    except Exception as e:
        conn.rollback()
        print(f"Migration failed: {e}")
    finally:
        conn.close()


if __name__ == "__main__":
    migrate()
