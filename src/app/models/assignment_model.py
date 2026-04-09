from typing import List, Dict
from flask import json
from app.database.db import get_db
from app.models import get_all_steps, get_all_workflows

import sqlite3



def get_steps_for_assignments(assignment_ids: List[int]) -> Dict:
    """
    Given a list of assignment IDs, return their steps and status options per step.
    Returns:
        {
            "steps": [
                {"id": int, "name": str, "order_num": int},
                ...
            ],
            "status_options": {
                step_id: [
                    {"name": str, "color": str, "y_position": int},
                    ...
                ]
            }
        }
    """
    conn = get_db()
    result = {
        "steps": [],
        "status_options": {}
    }

    if not assignment_ids:
        return result

    placeholders = ",".join(["?"] * len(assignment_ids))

    # Step 1: Fetch steps
    steps_query = f"""
        SELECT DISTINCT s.id, s.name, s.order_num
        FROM assignments a
        JOIN assignment_progress_steps aps ON aps.assignment_id = a.id
        JOIN steps s ON s.id = aps.step_id
        WHERE a.id IN ({placeholders})
        ORDER BY s.order_num

    """
    steps = conn.execute(steps_query, assignment_ids).fetchall()
    result["steps"] = [dict(row) for row in steps]
    step_ids = [row["id"] for row in steps]

    # Step 2: Fetch statuses if steps exist
    if not step_ids:
        return result

    placeholders_steps = ",".join(["?"] * len(step_ids))
    status_query = f"""
        SELECT 
            s.id AS step_id,
            n.name AS status_name,
            n.color AS status_color,
            CAST(SUBSTR(n.position, INSTR(n.position, ' ') + 1) AS INTEGER) AS y_position
        FROM steps s
        JOIN nodes n ON s.id = n.step_id
        WHERE s.id IN ({placeholders_steps})
        ORDER BY s.id, y_position
    """

    status_rows = conn.execute(status_query, step_ids).fetchall()
    for row in status_rows:
        sid = row["step_id"]
        if sid not in result["status_options"]:
            result["status_options"][sid] = []
        result["status_options"][sid].append({
            "name": row["status_name"],
            "color": row["status_color"],
            "y_position": row["y_position"]
        })

    return result

def get_individual_assignments_by_assignment(assignment_id, conn):
    query = """
        SELECT ia.id, ia.assignment_id, ia.name, 
               ia.users_id,  
               COALESCE(ia.start_date, 'Unknown Start Date') AS start_date,
               COALESCE(ia.completion_date, 'Unknown Completion Date') AS completion_date,
               COALESCE(u.name, 'Unknown Student') AS student_name,
               COALESCE(GROUP_CONCAT(DISTINCT iast.current_status ORDER BY iast.current_status), 'Not Started') AS current_status,
               COALESCE(ia.video_status, 'not_uploaded') AS video_status
        FROM individual_assignments ia
        LEFT JOIN users u ON ia.users_id = u.id
        LEFT JOIN individual_assignment_statuses iast 
            ON ia.id = iast.individual_assignment_id
        WHERE ia.assignment_id = ?
        GROUP BY ia.id, u.name
        ORDER BY u.name;
    """
    return [dict(row) for row in conn.execute(query, (assignment_id,)).fetchall()]

def get_assignment_form_data(class_id):
    return {
        "class_id": class_id,
        "workflows": get_all_workflows(),
        "steps": get_all_steps()
    }



