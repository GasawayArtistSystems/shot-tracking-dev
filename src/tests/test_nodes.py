# File: tests/test_nodes.py

import pytest
import sqlite3
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from nodes import add_node, update_node, delete_node, add_node_dependency, is_circular_dependency

# Use a mock database for tests
@pytest.fixture
def setup_database():
    """Set up an in-memory SQLite database."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("""
        CREATE TABLE nodes (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            task_id INTEGER NOT NULL,
            position INTEGER,
            status TEXT DEFAULT 'Standby',
            completion_percentage INTEGER DEFAULT 0,
            color TEXT DEFAULT 'lightgray'
        )
    """)
    conn.execute("""
        CREATE TABLE node_dependencies (
            parent_node_id INTEGER,
            parent_status TEXT,
            child_node_id INTEGER,
            child_status TEXT,
            PRIMARY KEY (parent_node_id, child_node_id)
        )
    """)
    yield conn
    conn.close()

def test_add_node(setup_database):
    """Test adding a new node."""
    conn = setup_database
    with conn:
        add_node("Test Node", 1, 1, "Ready", 50, "#FF5733", conn)
    node = conn.execute("SELECT * FROM nodes WHERE name = 'Test Node'").fetchone()
    assert node is not None
    assert node["name"] == "Test Node"
    assert node["status"] == "Ready"

def test_update_node(setup_database):
    """Test updating a node's attributes."""
    conn = setup_database
    with conn:
        add_node("Initial Node", 1, 1, conn=conn)
        update_node(1, name="Updated Node", color="#00FF00", conn=conn)
    node = conn.execute("SELECT * FROM nodes WHERE id = 1").fetchone()
    assert node["name"] == "Updated Node"
    assert node["color"] == "#00FF00"

def test_delete_node(setup_database):
    """Test deleting a node."""
    conn = setup_database
    with conn:
        add_node("Node to Delete", 1, 1, conn=conn)
        delete_node(1, conn=conn)
    node = conn.execute("SELECT * FROM nodes WHERE id = 1").fetchone()
    assert node is None

def test_add_dependency(setup_database):
    """Test adding a dependency."""
    conn = setup_database
    with conn:
        add_node("Parent Node", 1, 1, conn=conn)
        add_node("Child Node", 1, 2, conn=conn)
        add_node_dependency(1, "Ready", 2, "In Progress", conn=conn)
    dep = conn.execute("SELECT * FROM node_dependencies WHERE parent_node_id = 1").fetchone()
    assert dep is not None
    assert dep["child_node_id"] == 2

def test_circular_dependency_detection(setup_database):
    """Test detecting circular dependencies."""
    conn = setup_database
    with conn:
        add_node("Node A", 1, 1, conn=conn)
        add_node("Node B", 1, 2, conn=conn)
        add_node_dependency(1, "Ready", 2, "In Progress", conn=conn)
        add_node_dependency(2, "Completed", 1, "Blocked", conn=conn)
    assert is_circular_dependency(1, 2, conn=conn)





