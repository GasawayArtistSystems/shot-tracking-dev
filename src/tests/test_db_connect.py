from app import create_app
from app.database.db import get_db, query_db

def test_database_connection():
    # Create a Flask application instance
    app = create_app()

    # Use the app's application context
    with app.app_context():
        print("App context established.")

        # Test database connection
        db = get_db()
        print("Database connection established.")

        # Execute a simple query to confirm the connection
        rows = query_db("SELECT name FROM sqlite_master WHERE type='table';")
        print("Tables in the database:", [row['name'] for row in rows])

        print("Closing database connection.")
        db.close()

# Run the test
if __name__ == "__main__":
    test_database_connection()




