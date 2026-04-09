# File: tests/test_api.py

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from app import app
from db import init_db

@pytest.fixture
def client():
    """Set up a Flask test client with a clean database."""
    app.config['TESTING'] = True
    app.config['DATABASE'] = ":memory:"  # Use an in-memory database for testing
    with app.test_client() as client:
        with app.app_context():
            init_db()  # Initialize the database schema
        yield client


def test_load_nodes(client):
    """Test the /api/load endpoint."""
    # Insert mock data into the database
    with app.app_context():
        conn = client.application.config['DATABASE']
        conn.execute("INSERT INTO nodes (id, name, task_id, position, status) VALUES (1, 'Node A', 1, 1, 'Standby')")
        conn.commit()

    # Make a GET request to the endpoint
    response = client.get('/api/load?task_name=Assignment')
    assert response.status_code == 200
    data = response.get_json()

    # Verify the response structure
    assert "nodes" in data
    assert len(data["nodes"]) == 1
    assert data["nodes"][0]["name"] == "Node A"


def test_save_nodes(client):
    """Test the /api/save endpoint."""
    payload = {
        "nodes": [
            {"key": 1, "name": "Node A", "color": "#FF5733", "completion_percentage": 50},
        ],
        "links": [
            {"from": 1, "to": 2},
        ]
    }

    # Make a POST request to the endpoint
    response = client.post('/api/save', json=payload)
    assert response.status_code == 200

    # Verify the response
    data = response.get_json()
    assert data["status"] == "success"

    # Verify the data in the database
    with app.app_context():
        conn = client.application.config['DATABASE']
        node = conn.execute("SELECT * FROM nodes WHERE id = 1").fetchone()
        assert node is not None
        assert node["name"] == "Node A"


def test_invalid_save_nodes(client):
    """Test the /api/save endpoint with invalid data."""
    payload = {
        "nodes": [
            {"key": 1, "name": "", "color": "#ZZZZZZ", "completion_percentage": 150},  # Invalid name and color
        ],
        "links": []
    }

    # Make a POST request to the endpoint
    response = client.post('/api/save', json=payload)
    assert response.status_code == 400  # Expecting a bad request
    data = response.get_json()
    assert data["status"] == "error"
    assert "Invalid data" in data["message"]




