from app import create_app
from app.models import get_individual_assignments_for_user
import sqlite3

# Create the Flask app
app = create_app()

def test_assignment_filtering():
    db_path = r"D:\Development\shot-tracking-dev\src\app\database\app.db"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row  # Allows dictionary-style access

    user_id = 32  # Change as needed
    class_id = 22
    permission_level = 1# Change for different levels

    query = """
    SELECT DISTINCT ia.*, n.id AS node_id, n.name AS node_name
    FROM individual_assignments ia
    JOIN assignments a ON ia.assignment_id = a.id
    JOIN tasks t ON a.workflow_id = t.workflow_id  -- Link assignments to workflows
    JOIN nodes n ON t.id = n.task_id  -- Fetch individual flow nodes
    WHERE ia.users_id = ?
    AND a.class_id = ?
    AND a.workflow_id IS NOT NULL
    AND n.id IN (
        -- Select only nodes where at least one is visible for the user based on permission level
        SELECT DISTINCT n2.id
        FROM tasks t2
        JOIN nodes n2 ON t2.id = n2.task_id  -- Ensure filtering at the individual node (flow) level
        JOIN assignments a2 ON a2.workflow_id = t2.workflow_id  -- Match correct assignments
        JOIN individual_assignments ia2 ON ia2.assignment_id = a2.id  -- Ensure user-specific assignments
        WHERE t2.min_permission_level <= ?  -- Replace with permission level 1, 2, or 3
        AND ia2.users_id = ?  -- Ensure it's linked to the correct user
        AND a2.class_id = ?  -- Ensure it's from the correct class
    )
    ORDER BY n.id;
    """

    cursor = conn.execute(query, (user_id, class_id, permission_level, user_id, class_id))
    results = cursor.fetchall()

    print("Query Results:")
    for row in results:
        print(dict(row))  # Print results as dictionaries for better readability

    conn.close()

# Run the test
test_assignment_filtering()




