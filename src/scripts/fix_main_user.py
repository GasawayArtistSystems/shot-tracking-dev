# scripts/reset_main_user_password.py

"""
Script to manually reset the 'main' user's password in the SQLite DB.
WARNING: This is a dev-only utility. Do not use in production.
"""

import sqlite3
from werkzeug.security import generate_password_hash

def reset_main_password():
    db_path = "D:/Development/shot-tracking-dev/src/app/database/app.db"
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    new_hash = generate_password_hash("00New00")
    print("[OK] Generated Hash:", new_hash)

    cursor.execute("UPDATE users SET password_hash = ? WHERE login_name = ?", (new_hash, 'main'))
    conn.commit()
    conn.close()

    print("[OK] Password for 'main' updated successfully.")

if __name__ == "__main__":
    reset_main_password()



