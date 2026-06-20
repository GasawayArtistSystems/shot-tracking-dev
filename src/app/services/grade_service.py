from app.database.db import get_db

# ------------------------------------------------------------------
# GRADE SCALE
# ------------------------------------------------------------------

def get_letter_grade(percentage):
    """Convert a percentage to a letter grade using standard UC scale."""
    if percentage >= 93: return "A"
    if percentage >= 90: return "A-"
    if percentage >= 87: return "B+"
    if percentage >= 83: return "B"
    if percentage >= 80: return "B-"
    if percentage >= 77: return "C+"
    if percentage >= 73: return "C"
    if percentage >= 70: return "C-"
    if percentage >= 67: return "D+"
    if percentage >= 63: return "D"
    if percentage >= 60: return "D-"
    return "F"


# ------------------------------------------------------------------
# GRADE EXTRACTION
# ------------------------------------------------------------------

def extract_numeric_grade(status_string):
    """
    Pull the numeric value out of a grade status string.
    e.g. '3 - B' → 3, '0 - Not completed' → 0, 'Standby' → None
    """
    if not status_string:
        return None
    try:
        first = status_string.split(" - ")[0].strip()
        val = float(first)
        return val
    except (ValueError, IndexError):
        return None


# ------------------------------------------------------------------
# CORE GRADE CALCULATION
# ------------------------------------------------------------------

def get_student_grade_summary(user_id, class_id):
    """
    Calculate current grade and projected grade for a student in a class.
    
    Returns:
    {
        "current_points": 12,
        "current_max": 16,          # only graded assignments so far
        "current_percentage": 75.0,
        "current_letter": "C",
        "projected_points": 12,
        "projected_max": 28,        # all assignments in class
        "projected_percentage": 42.8,
        "projected_letter": "F",
        "total_max_points": 28,     # total possible for class
        "extra_credit": 0,
        "assignments": [...]        # per-assignment breakdown
    }
    """
    conn = get_db()

    # Get all assignments for this class with their max_points
    assignments = conn.execute("""
        SELECT a.id, a.name, a.max_points, a.parent_step_id
        FROM assignments a
        WHERE a.class_id = ?
        ORDER BY a.name
    """, (class_id,)).fetchall()

    if not assignments:
        return None

    current_points = 0
    current_max = 0
    projected_points = 0
    total_max_points = 0
    extra_credit = 0
    assignment_breakdown = []

    for assignment in assignments:
        assignment_id = assignment["id"]
        max_pts = assignment["max_points"] or 4
        parent_step_id = assignment["parent_step_id"]

        # Get the individual assignment for this student
        ia = conn.execute("""
            SELECT id FROM individual_assignments
            WHERE assignment_id = ? AND users_id = ?
        """, (assignment_id, user_id)).fetchone()

        if not ia:
            continue

        ia_id = ia["id"]

        # Get all grade steps for this individual assignment
        grade_rows = conn.execute("""
            SELECT ias.current_status, s.name as step_name
            FROM individual_assignment_statuses ias
            JOIN steps s ON ias.step_id = s.id
            WHERE ias.individual_assignment_id = ?
            AND s.name LIKE 'Grade%'
        """, (ia_id,)).fetchall()

        # Sum all numeric grades for this assignment
        earned = 0
        is_graded = False
        for row in grade_rows:
            val = extract_numeric_grade(row["current_status"])
            if val is not None and val > 0:
                earned += val
                is_graded = True

        # Extra credit assignments (Evaluation) don't count toward max
        # Identified by having no max_points or being flagged separately
        # For now: if assignment name contains 'Evaluation', treat as extra credit
        is_extra_credit = "evaluation" in assignment["name"].lower()

        if is_extra_credit:
            extra_credit += earned
        else:
            total_max_points += max_pts
            projected_points += earned  # counts as 0 if not graded

            if is_graded:
                current_points += earned
                current_max += max_pts

        assignment_breakdown.append({
            "assignment_id": assignment_id,
            "assignment_name": assignment["name"],
            "earned": earned,
            "max_points": max_pts,
            "is_graded": is_graded,
            "is_extra_credit": is_extra_credit
        })

    # Calculate percentages
    current_percentage = round((current_points / current_max * 100), 1) if current_max > 0 else 0
    projected_percentage = round((projected_points / total_max_points * 100), 1) if total_max_points > 0 else 0

    return {
        "current_points": current_points,
        "current_max": current_max,
        "current_percentage": current_percentage,
        "current_letter": get_letter_grade(current_percentage) if current_max > 0 else "N/A",
        "projected_points": projected_points,
        "projected_max": total_max_points,
        "projected_percentage": projected_percentage,
        "projected_letter": get_letter_grade(projected_percentage) if total_max_points > 0 else "N/A",
        "total_max_points": total_max_points,
        "extra_credit": extra_credit,
        "assignments": assignment_breakdown
    }


# ------------------------------------------------------------------
# CLASS-WIDE GRADES (instructor view)
# ------------------------------------------------------------------

def get_class_grade_summary(class_id):
    """
    Get grade summary for every student in a class.
    Returns a list of {student_name, user_id, ...grade_summary}
    """
    conn = get_db()

    students = conn.execute("""
        SELECT u.id, u.name
        FROM users u
        JOIN class_enrollments ce ON u.id = ce.user_id
        WHERE ce.class_id = ?
        ORDER BY u.name
    """, (class_id,)).fetchall()

    results = []
    for student in students:
        summary = get_student_grade_summary(student["id"], class_id)
        if summary:
            results.append({
                "user_id": student["id"],
                "student_name": student["name"],
                **summary
            })

    return results