from app.database.db import get_db

def get_user_films(user_id):
    conn = get_db()
    query = """
        SELECT f.*, g.name AS role
        FROM film_crew fc
        JOIN films f ON f.id = fc.film_id
        JOIN groups g ON fc.group_id = g.id
        WHERE fc.user_id = ?
        ORDER BY f.id DESC
    """
    rows = conn.execute(query, (user_id,)).fetchall()
    return [dict(row) for row in rows]



