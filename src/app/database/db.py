import os
import sqlite3
from flask import g, Flask
from dotenv import load_dotenv
from app.config import DATABASE

# [OK] Load environment variables
load_dotenv()

# [OK] Dynamic Database Path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# DATABASE = os.getenv("DATABASE", os.path.join(os.path.dirname(__file__), "app.db"))

def get_db():
    """Get a database connection, create one if it doesn't exist."""
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")  # [OK] Enforce foreign keys
    return g.db

def close_db(error=None):
    db = g.pop('db', None)
    if db is not None:
        print("âŒ Database connection CLOSED in close_db()")
        db.close()


def init_db():
    """Initialize the database schema."""
    schema_path = os.path.join(BASE_DIR, "schema.sql")
    if not os.path.exists(schema_path):
        raise FileNotFoundError(f"Schema file not found at {schema_path}")

    conn = get_db()  # [OK] Use get_db() to ensure proper connection handling
    conn.executescript(open(schema_path, "r").read())
    conn.commit()


def query_db(query, args=(), one=False):
    """Execute a query and fetch results safely."""
    try:
        conn = get_db()  # [OK] Ensure a fresh connection
        cur = conn.execute(query, args)
        rv = cur.fetchall()
        return (rv[0] if rv else None) if one else rv
    except sqlite3.ProgrammingError as e:
        print(f"âŒ ERROR: Database connection issue -> {e}")
        return None


def get_nodes_for_task(step_id):
    """
    Fetch all nodes associated with a given step_id.

    :param step_id: The step ID used to retrieve workflow nodes.
    :return: List of node dictionaries.
    """
    conn = get_db()

    query = """
    SELECT id, step_id, name, position 
    FROM nodes 
    WHERE step_id = ?
    ORDER BY position
    """
    
    nodes = conn.execute(query, (step_id,)).fetchall()

    # [OK] Convert to list of dictionaries
    nodes_list = [dict(row) for row in nodes]
    
    print(f"ðŸ“¢ DEBUG: Fetched nodes for step_id={step_id}: {nodes_list}")
    
    return nodes_list


def modify_db(query, params=()):
    """Execute INSERT, UPDATE, DELETE queries and commit changes."""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(query, params)
    conn.commit()
    return cursor.lastrowid  # ðŸ”¹ Returns last inserted row ID, useful for INSERTs

def get_top_status_for_node(step_id, node_id):
    """Fetch the top-most status for a node based on the lowest Y position for that node_id."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT id, position FROM nodes
        WHERE step_id = ? AND id = ?
        ORDER BY CAST(SUBSTR(position, INSTR(position, ' ') + 1) AS FLOAT) ASC
        LIMIT 1
    """, (step_id, node_id))

    row = cursor.fetchone()
    if not row:
        print(f"âš ï¸ No nodes found for Task {step_id}, Node {node_id}")
        return None

    selected_node_id, position = row
    print(f"ðŸ“¢ Selected Node ID: {selected_node_id} | Position: {position} for Step ID: {step_id}")

    cursor.execute("""
        SELECT current_status FROM individual_assignment_statuses
        WHERE step_id = ?
        LIMIT 1
    """, (selected_node_id,))

    status_row = cursor.fetchone()
    if status_row:
        return status_row[0]

    print(f"âš ï¸ No status found for Node ID: {selected_node_id} (Task {step_id})")
    return None

def set_node_status(node_id, individual_assignment_id, status):
    """Set the default status for a node when the assignment is created."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO individual_assignment_statuses (individual_assignment_id, step_id, current_status)
        VALUES (?, ?, ?)
    """, (individual_assignment_id, node_id, status))

    conn.commit()




