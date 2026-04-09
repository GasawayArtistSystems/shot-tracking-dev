from flask import Blueprint, request, jsonify, render_template
from datetime import datetime
from app.database.db import get_db

semesters_bp = Blueprint('semesters', __name__, url_prefix='/semesters')

@semesters_bp.route('/', methods=['GET'])
def get_semesters():
    """Retrieve all semesters"""
    query = "SELECT * FROM semesters ORDER BY year DESC, term DESC"
    conn = get_db()
    semesters = [dict(row) for row in conn.execute(query)]
    return jsonify(semesters)

@semesters_bp.route('/<int:id>', methods=['GET'])
def get_semester(id):
    """Retrieve a single semester by ID"""
    query = "SELECT * FROM semesters WHERE id = ?"
    conn = get_db()
    semester = conn.execute(query, (id,)).fetchone()

    if not semester:
        return jsonify({"error": "Semester not found"}), 404

    return jsonify(dict(semester))

@semesters_bp.route('/current', methods=['GET'])
def get_current_semester():
    """Retrieve the current semester based on today's date"""
    today = datetime.today().date()
    query = """
    SELECT * FROM semesters 
    WHERE start_date <= ? AND end_date >= ? 
    ORDER BY year DESC, term DESC 
    LIMIT 1;
    """
    conn = get_db()
    semester = conn.execute(query, (today, today)).fetchone()

    if semester:
        return jsonify(dict(semester))
    else:
        return jsonify({"message": "No active semester found"}), 404

@semesters_bp.route('/', methods=['POST'])
def create_semester():
    """Create a new semester"""
    data = request.json
    query = "INSERT INTO semesters (term, year, start_date, end_date) VALUES (?, ?, ?, ?)"
    conn = get_db()
    conn.execute(query, (data['term'], data['year'], data['start_date'], data['end_date']))
    conn.commit()
    return jsonify({"message": "Semester added successfully"}), 201

@semesters_bp.route('/<int:id>', methods=['PUT'])
def update_semester(id):
    """Update semester details"""
    data = request.json
    query = "UPDATE semesters SET term=?, year=?, start_date=?, end_date=? WHERE id=?"
    conn = get_db()
    conn.execute(query, (data['term'], data['year'], data['start_date'], data['end_date'], id))
    conn.commit()
    return jsonify({"message": "Semester updated successfully"})

@semesters_bp.route('/<int:id>', methods=['DELETE'])
def delete_semester(id):
    conn = get_db()

    # Check for classes using the semester
    class_count = conn.execute(
        "SELECT COUNT(*) FROM classes WHERE semester_id = ?", (id,)
    ).fetchone()[0]

    # Check for films using the semester (if applicable)
    film_count = conn.execute(
        "SELECT COUNT(*) FROM films WHERE semester_id = ?", (id,)
    ).fetchone()[0]

    # You can add more checks for other tables...

    if class_count > 0 or film_count > 0:
        return jsonify({
            "error": (
                f"Cannot delete semester: it's used in "
                f"{class_count} class{'es' if class_count != 1 else ''} and "
                f"{film_count} film{'s' if film_count != 1 else ''}."
            )
        }), 400

    # Safe to delete
    conn.execute("DELETE FROM semesters WHERE id=?", (id,))
    conn.commit()
    return jsonify({"message": "Semester deleted successfully"})



@semesters_bp.route('/manage', methods=['GET'])
def manage_semesters():
    """Render semester management page"""
    return render_template("admin/settings_semesters.html")

def get_available_semesters():
    """Retrieve all semesters for dropdowns."""
    query = "SELECT id, term || ' ' || year AS semester FROM semesters ORDER BY year DESC, term DESC"
    conn = get_db()
    return [dict(row) for row in conn.execute(query)]



