from app import create_app
from flask import Flask

# Import the route directly (to ensure the file gets loaded)
from app.routes.assignments_routes import add_individual_assignment_route

# Initialize the Flask app
app = create_app()

def test_add_individual_assignment_with_nodes():
    """Test adding individual assignments with workflow starting nodes."""
    with app.test_client() as client:
        with app.app_context():
            assignment_id = 46  # Use an assignment with a valid workflow
            mock_form_data = {
                'class_id': '22',
                'user_id': '32',
                'start_date': '2025-01-19',
                'completion_date': '2025-01-26'
            }

            print("Starting test_add_individual_assignment_with_nodes...")
            response = client.post(f'/assignments/{assignment_id}/individual/add', data=mock_form_data)
            print(f"Response Status Code: {response.status_code}")
            print(f"Response Data: {response.data.decode('utf-8')}")

# Call the test
if __name__ == "__main__":
    test_add_individual_assignment_with_nodes()




