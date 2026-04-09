from app.database.db import get_db

def get_todo_shots(user_id):
    conn = get_db()
    query = """
        SELECT s.*, sc.scene_number, f.name as film_name, sa.status
        FROM shots s
        JOIN scenes sc ON s.scene_id = sc.id
        JOIN films f ON sc.film_id = f.id
        JOIN shot_step_assignments sa ON sa.shot_id = s.id
        WHERE s.assigned_to = ?
          AND (sa.status IS NULL OR sa.status != 'Approved')
        ORDER BY f.id DESC, sc.scene_number, s.shot_number
    """
    rows = conn.execute(query, (user_id,)).fetchall()
    return [dict(row) for row in rows]



