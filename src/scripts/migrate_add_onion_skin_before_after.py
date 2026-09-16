# migrate_add_onion_skin_before_after.py
# Splits user_preferences.onion_skin_frames into separate
# onion_skin_frames_before / onion_skin_frames_after columns so the
# Preferences panel can control before/after onion skin depth independently.
# Existing onion_skin_frames values are copied into both new columns so
# current preferences keep behaving the same until a user changes them.
#
# Run once, from the src/ directory:
#   python scripts/migrate_add_onion_skin_before_after.py

import sqlite3

DB_PATH = "app/database/app.db"


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    existing_cols = {
        row[0] for row in cur.execute("SELECT name FROM pragma_table_info('user_preferences')").fetchall()
    }

    if "onion_skin_frames_before" not in existing_cols:
        cur.execute("ALTER TABLE user_preferences ADD COLUMN onion_skin_frames_before INTEGER DEFAULT 4")
        print("Added user_preferences.onion_skin_frames_before")
    else:
        print("user_preferences.onion_skin_frames_before already exists, skipping.")

    if "onion_skin_frames_after" not in existing_cols:
        cur.execute("ALTER TABLE user_preferences ADD COLUMN onion_skin_frames_after INTEGER DEFAULT 4")
        print("Added user_preferences.onion_skin_frames_after")
    else:
        print("user_preferences.onion_skin_frames_after already exists, skipping.")

    if "onion_skin_frames" in existing_cols:
        cur.execute("""
            UPDATE user_preferences
            SET onion_skin_frames_before = onion_skin_frames,
                onion_skin_frames_after = onion_skin_frames
            WHERE onion_skin_frames IS NOT NULL
        """)
        print("Backfilled before/after from existing onion_skin_frames values")

    conn.commit()
    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
