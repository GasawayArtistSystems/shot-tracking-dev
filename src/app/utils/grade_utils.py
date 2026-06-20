from app.database.db import get_db
from flask import session

def save_grade_history(conn, individual_assignment_id, step_id, new_grade):
    """
    Reads the current grade for this individual_assignment + step,
    and writes it to grade_history before it gets overwritten.
    Only saves history if the grade is actually changing.
    """
    print(f"[HISTORY] save_grade_history called: ia={individual_assignment_id} step={step_id} new={new_grade}")

    changed_by = session.get('user_id')

    # Read current value before overwrite
    row = conn.execute("""
        SELECT current_status FROM individual_assignment_statuses
        WHERE individual_assignment_id = ? AND step_id = ?
    """, (individual_assignment_id, step_id)).fetchone()

    if not row:
        return  # no existing record, nothing to save

    old_grade = row['current_status']

    # Only write history if the grade is actually changing
    if old_grade == new_grade:
        return

    conn.execute("""
        INSERT INTO grade_history 
            (individual_assignment_id, step_id, old_grade, new_grade, changed_by)
        VALUES (?, ?, ?, ?, ?)
    """, (individual_assignment_id, step_id, old_grade, new_grade, changed_by))

    print(f"[OK] Grade history saved: ia={individual_assignment_id} step={step_id} {old_grade} → {new_grade}")