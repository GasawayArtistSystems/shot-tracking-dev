# app/models/bug_report.py

from app.database.db import get_db

class BugReport:
    @staticmethod
    def insert(data):
        db = get_db()
        db.execute('''
            INSERT INTO bug_reports (type, title, description, email, department, area, priority, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            data.get('type'),
            data.get('title'),
            data.get('description'),
            data.get('email'),
            data.get('department'),
            data.get('area'),
            data.get('priority'),
            data.get('timestamp')
        ))
        db.commit()

    @staticmethod
    def get_by_id(bug_id):
        db = get_db()
        row = db.execute(
            "SELECT * FROM bug_reports WHERE id = ?", (bug_id,)
        ).fetchone()
        return dict(row) if row else None

    @staticmethod
    def get_all():
        db = get_db()
        return db.execute('SELECT * FROM bug_reports ORDER BY id DESC').fetchall()
    

    @staticmethod
    def get_by_status(status: str):
        conn = get_db()
        conn.row_factory = None  # or keep your global row_factory if you have one
        cur = conn.cursor()
        cur.execute("SELECT * FROM bug_reports WHERE status = ? ORDER BY id DESC", (status,))
        rows = cur.fetchall()
        conn.close()

        # If you normally return dicts elsewhere, convert here:
        # (Remove this if your connection already returns dict-like rows)
        result = []
        for r in rows:
            # adjust indexes to your table order if needed
            result.append({
                "id": r[0],
                "type": r[1],
                "title": r[2],
                "description": r[3],
                "email": r[4],
                "department": r[5],
                "area": r[6],
                "priority": r[7],
                "timestamp": r[8],
                "status": r[9],
            })
        return result



    @staticmethod
    def mark_resolved(bug_id):
        db = get_db()
        db.execute('UPDATE bug_reports SET status = ? WHERE id = ?', ('Resolved', bug_id))
        db.commit()

    @staticmethod
    def archive(bug_id: int):
        conn = get_db()
        cur = conn.cursor()
        cur.execute("UPDATE bug_reports SET status = ? WHERE id = ?", ("Archived", bug_id))
        conn.commit()
        conn.close()

    @staticmethod
    def delete(bug_id: int):
        conn = get_db()            # <-- use your helper
        cur = conn.cursor()
        cur.execute("DELETE FROM bug_reports WHERE id = ?", (bug_id,))
        conn.commit()
        conn.close()




