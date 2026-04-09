import os
import sqlite3
from app.config import DATABASE

def reset_test_database():
    """
    Resets the test database.
    Drops existing tables and recreates the schema from 'schema.sql'.
    """
    print(f"Resetting test database at: {DATABASE}")
    
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    with sqlite3.connect(DATABASE) as conn:
        # Drop all tables to reset the database
        conn.execute("PRAGMA foreign_keys = OFF;")
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = [row[0] for row in cursor.fetchall()]
        for table in tables:
            conn.execute(f"DROP TABLE IF EXISTS {table};")
        conn.commit()
        
        # Recreate schema
        with open(schema_path, "r") as schema_file:
            conn.executescript(schema_file.read())
        conn.commit()

    print("Test database reset successfully.")

if __name__ == "__main__":
    reset_test_database()




