import os
import sqlite3
from app.config import DATABASE

def initialize_database():
    """
    Initialize the database schema.
    Reads the schema from 'schema.sql' and applies it to the database.
    """
    schema_path = os.path.join(os.path.dirname(__file__), "schema.sql")
    print(f"Using schema file: {schema_path}")
    print(f"Initializing database at: {DATABASE}")

    with open(schema_path, "r") as schema_file:
        schema = schema_file.read()
    with sqlite3.connect(DATABASE) as conn:
        conn.executescript(schema)
        conn.commit()
    print("Database initialized successfully.")

if __name__ == "__main__":
    initialize_database()




