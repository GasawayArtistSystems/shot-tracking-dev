from flask import Blueprint, request, jsonify
from app.database.db import get_db


assignment_bp = Blueprint('assignment', __name__)

def fetch_user_assignments(user_id, semester_id=None):
    conn = get_db()
    query = """
        SELECT ia.id,
               ia.assignment_id,
               a.name AS assignment_name,
               u.name AS user_name,
               ia.start_date,
               ia.completion_date,
               COALESCE(ias.current_status, 'Not Started') AS current_status
        FROM individual_assignments ia
        JOIN assignments a ON ia.assignment_id = a.id
        JOIN users u ON ia.users_id = u.id
        LEFT JOIN individual_assignment_statuses ias ON ia.id = ias.individual_assignment_id
        WHERE ia.users_id = ?
    """
    params = [user_id]

    if semester_id:
        query += """
            AND ia.assignment_id IN (
                SELECT a.id
                FROM assignments a
                JOIN classes c ON a.class_id = c.id
                WHERE c.semester_id = ?
            )
        """
        params.append(semester_id)

    query += " ORDER BY ia.completion_date ASC"

    rows = conn.execute(query, tuple(params)).fetchall()
    return [dict(row) for row in rows]


def fetch_todo_assignments(user_id, semester_id=None):
    conn = get_db()

    try:
        query = """
            SELECT ia.id,
                   a.name AS assignment_name,
                   cl.class_name AS class_name,
                   u.name AS user_name,
                   ia.completion_date,
                   s.name AS step_name,
                   COALESCE(ias.current_status, 'Not Started') AS status
            FROM individual_assignments ia
            JOIN assignments a ON ia.assignment_id = a.id
            JOIN classes cl ON a.class_id = cl.id
            JOIN users u ON ia.users_id = u.id
            LEFT JOIN individual_assignment_statuses ias ON ia.id = ias.individual_assignment_id
            LEFT JOIN steps s ON ias.step_id = s.id
            WHERE ia.users_id = ?
              AND (ias.current_status IS NULL OR ias.current_status NOT IN ('Approved', 'Graded'))
        """

        params = [user_id]

        if semester_id is not None:
            query += " AND cl.semester_id = ?"
            params.append(semester_id)

        query += " ORDER BY ia.completion_date ASC"

        rows = conn.execute(query, tuple(params)).fetchall()
        return [dict(row) for row in rows]

    except Exception as e:
        print(f"SQL Error in fetch_todo_assignments: {e}", flush=True)
        return []




def fetch_graded_assignments(user_id):
    conn = get_db()
    query = """
        SELECT ia.id, ia.name AS assignment_name, cl.class_name AS class_name, ias.current_status AS grade
        FROM individual_assignments ia
        JOIN assignments a ON ia.assignment_id = a.id
        JOIN classes cl ON a.class_id = cl.id
        JOIN individual_assignment_statuses ias ON ias.individual_assignment_id = ia.id
        WHERE ia.users_id = ?
          AND ias.current_status IN ('Approved', 'Graded')
        ORDER BY ia.completion_date DESC
    """
    rows = conn.execute(query, (user_id,)).fetchall()
    return rows


def get_user_assignments_by_semester(user_id, semester_id):
    conn = get_db()
    query = """
        SELECT ia.id AS individual_assignment_id,
            ia.assignment_id,
            a.name AS assignment_name,
            a.parent_step_id,
            c.id AS class_id,
            c.class_name,
            ia.completion_date
        FROM class_enrollments ce
        JOIN classes c ON ce.class_id = c.id AND c.semester_id = ?
        JOIN assignments a ON a.class_id = c.id
        JOIN individual_assignments ia ON ia.assignment_id = a.id AND ia.users_id = ce.user_id
        WHERE ce.user_id = ?
            AND (? IS NULL OR c.semester_id = ?)
    """
    assignments = conn.execute(query, (semester_id, user_id, semester_id, semester_id)).fetchall()

    results = []

    for row in assignments:
        ia_id = row["individual_assignment_id"]
        flow_id = row["parent_step_id"]

        step_rows = conn.execute(
            "SELECT id, name FROM steps WHERE parent_id = ?",
            (flow_id,)
        ).fetchall()

        def get_status(step):
            if not step:
                return None
            status_row = conn.execute(
                """
                SELECT current_status FROM individual_assignment_statuses
                WHERE individual_assignment_id = ? AND step_id = ?
                """,
                (ia_id, step["id"])
            ).fetchone()
            return status_row["current_status"] if status_row else None

        # Pre-fetch FB status
        step_fb = next((s for s in step_rows if s["name"].lower().startswith("fb")), None)
        fb_status = get_status(step_fb)

        # Visible steps = everything except FB/Grade steps
        visible_steps = [
            s for s in step_rows
            if not (s["name"].lower().startswith("fb") or s["name"].lower().startswith("grade"))
        ]

        for step in visible_steps:
            step_id = step["id"]
            assignment_status = get_status(step)

            # 🔑 Hybrid grade logic
            step_grades = []

            # Case 1: Look for a grade specifically tied to this step (Grade-<step>)
            grade_step_name = f"Grade-{step['name']}"
            grade_step = next((s for s in step_rows if s["name"] == grade_step_name), None)
            if grade_step:
                status_row = conn.execute(
                    """
                    SELECT current_status FROM individual_assignment_statuses
                    WHERE individual_assignment_id = ? AND step_id = ?
                    """,
                    (ia_id, grade_step["id"])
                ).fetchone()
                step_grades.append(status_row["current_status"] if status_row else "0 - Not completed")
            else:
                # Case 2: Pose-type assignment → collect all Grade-* steps
                pose_grades = []
                for s in step_rows:
                    if s["name"].lower().startswith("grade"):
                        status_row = conn.execute(
                            """
                            SELECT current_status FROM individual_assignment_statuses
                            WHERE individual_assignment_id = ? AND step_id = ?
                            """,
                            (ia_id, s["id"])
                        ).fetchone()
                        pose_grades.append(status_row["current_status"] if status_row else "0 - Not completed")
                if pose_grades:
                    step_grades.extend(pose_grades)

            # Fetch dropdown options
            node_rows = conn.execute(
                """
                SELECT name, color, position FROM nodes
                WHERE step_id = ?
                ORDER BY CAST(SUBSTR(position, INSTR(position, ' ') + 1) AS INT)
                """,
                (step_id,)
            ).fetchall()
            dropdown_options = [
                {"name": n["name"], "color": n["color"]} for n in node_rows
            ]

            results.append({
                "assignment_name": row["assignment_name"],
                "class_name": row["class_name"],
                "class_id": row["class_id"],
                "assignment_id": row["assignment_id"],
                "completion_date": row["completion_date"],
                "individual_assignment_id": ia_id,
                "assignment_status": assignment_status,
                "fb_status": fb_status,
                "grades": step_grades,
                "step_name": step["name"],
                "step_id": step_id,
                "dropdown_options": dropdown_options
            })

    return {"todo": results}
