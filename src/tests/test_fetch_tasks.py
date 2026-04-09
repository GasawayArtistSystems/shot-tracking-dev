# test_fetch_tasks.py

from app import create_app  # Import your Flask app factory
from app.models import get_tasks_with_permission
from app.models import get_db

def test_fetch_tasks():
    # Initialize the app
    app = create_app()  # Replace `create_app` with your actual app factory function
    with app.app_context():  # Create the application context
        # Example inputs for the test
        workflow_id = 10  # Replace with a valid workflow_id from your tasks table
        user_permission_level = 3  # Replace with the permission level to test (e.g., Instructor)

        # Fetch tasks for the workflow and permission level
        tasks = get_tasks_with_permission(workflow_id, user_permission_level)

        # Print the tasks for verification
        if tasks:
            print(f"Tasks for workflow_id={workflow_id} and permission_level={user_permission_level}:")
            for task in tasks:
                print(task)
        else:
            print(f"No tasks found for workflow_id={workflow_id} and permission_level={user_permission_level}")

if __name__ == "__main__":
    test_fetch_tasks()




