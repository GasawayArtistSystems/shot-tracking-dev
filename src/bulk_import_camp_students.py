# bulk_import_camp_students.py
# Run on the server: python bulk_import_camp_students.py
# from C:\myapp\shot-tracking-dev\src\

import sqlite3
import json
import os
import sys
from werkzeug.security import generate_password_hash

# =====================================================
# CONFIG
# =====================================================
DB_PATH = r"C:\myapp\shot-tracking-dev\src\app\database\app.db"
STUDENTS_JSON = r"C:\Cincy\Configs\daap_students.json"
DAAP_CLASS_NAME = "DAAP CAMP"
SEMESTER_LABEL = "2026-Summer"
STUDENT_GROUP_NAME = "Student"

# =====================================================
# HELPERS
# =====================================================
def get_conn():
    # No row_factory — use index access everywhere
    conn = sqlite3.connect(DB_PATH)
    return conn

def make_login(name):
    return name.replace(" ", "").lower()

def load_students():
    with open(STUDENTS_JSON, "r") as f:
        data = json.load(f)
    return data.get("students", [])

def fetchone_idx(conn, sql, params=()):
    """Execute and return first row as plain tuple."""
    cur = conn.execute(sql, params)
    return cur.fetchone()

def fetchall_idx(conn, sql, params=()):
    """Execute and return all rows as plain tuples."""
    cur = conn.execute(sql, params)
    return cur.fetchall()

def get_class_id(conn):
    row = fetchone_idx(conn, """
        SELECT c.id FROM classes c
        JOIN semesters s ON s.id = c.semester_id
        WHERE c.class_name = ?
        AND (s.year || '-' || s.term) = ?
    """, (DAAP_CLASS_NAME, SEMESTER_LABEL))
    return row[0] if row else None

def get_student_group_id(conn):
    row = fetchone_idx(conn, "SELECT id FROM groups WHERE name = ?", (STUDENT_GROUP_NAME,))
    return row[0] if row else None

def get_assignments_for_class(conn, class_id):
    return fetchall_idx(conn, "SELECT id, name FROM assignments WHERE class_id = ?", (class_id,))

def get_steps_for_assignment(conn, assignment_id):
    rows = fetchall_idx(conn, """
        SELECT step_id FROM assignment_progress_steps WHERE assignment_id = ?
    """, (assignment_id,))
    return [r[0] for r in rows]

def get_user_id(conn, login):
    row = fetchone_idx(conn, "SELECT id FROM users WHERE login_name = ?", (login,))
    return row[0] if row else None

def main():
    print("=" * 50)
    print("  DAAP CAMP 2026 — Bulk Student Import")
    print("=" * 50)

    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found: {DB_PATH}")
        sys.exit(1)

    if not os.path.exists(STUDENTS_JSON):
        print(f"ERROR: Students JSON not found: {STUDENTS_JSON}")
        sys.exit(1)

    students = load_students()
    print(f"\nFound {len(students)} students in {STUDENTS_JSON}")

    conn = get_conn()

    # Get class ID
    class_id = get_class_id(conn)
    if not class_id:
        print(f"ERROR: Class '{DAAP_CLASS_NAME}' not found for semester {SEMESTER_LABEL}")
        conn.close()
        sys.exit(1)
    print(f"Found class: {DAAP_CLASS_NAME} (id={class_id})")

    # Get group ID
    group_id = get_student_group_id(conn)
    if not group_id:
        print(f"WARNING: Group '{STUDENT_GROUP_NAME}' not found")
    else:
        print(f"Found group: {STUDENT_GROUP_NAME} (id={group_id})")

    # Get assignments
    assignments = get_assignments_for_class(conn, class_id)
    if not assignments:
        print(f"WARNING: No assignments found for {DAAP_CLASS_NAME}")
    else:
        print(f"Found {len(assignments)} assignments:")
        for a in assignments:
            print(f"   - {a[1]}")

    print(f"\n{'=' * 50}")
    print("  Processing students...")
    print(f"{'=' * 50}\n")

    created = 0
    skipped = 0
    errors = 0

    for name in students:
        print(f"  {name}")
        try:
            login = make_login(name)
            password_hash = generate_password_hash(login)
            email = f"{login}@daapcamp.uc.edu"

            # Create user if not exists
            existing_id = get_user_id(conn, login)
            if existing_id:
                user_id = existing_id
                print(f"    User exists (id={user_id})")
                skipped += 1
            else:
                cur = conn.execute("""
                    INSERT INTO users (name, login_name, email, password_hash)
                    VALUES (?, ?, ?, ?)
                """, (name, login, email, password_hash))
                user_id = cur.lastrowid
                print(f"    Created user (id={user_id})")
                created += 1

            # Assign to Student group
            if group_id:
                conn.execute("""
                    INSERT OR IGNORE INTO user_groups (user_id, group_id)
                    VALUES (?, ?)
                """, (user_id, group_id))

            # Enroll in class
            existing_enrollment = fetchone_idx(conn, """
                SELECT class_id FROM class_enrollments
                WHERE user_id = ? AND class_id = ?
            """, (user_id, class_id))

            if existing_enrollment:
                print(f"    Already enrolled")
            else:
                conn.execute("""
                    INSERT INTO class_enrollments (user_id, class_id, semester_id)
                    VALUES (?, ?, (SELECT id FROM semesters WHERE year || '-' || term = ?))
                """, (user_id, class_id, SEMESTER_LABEL))
                print(f"    Enrolled in {DAAP_CLASS_NAME}")

            # Create individual assignments
            for assignment in assignments:
                assignment_id = assignment[0]
                assignment_name = assignment[1]

                existing_ia = fetchone_idx(conn, """
                    SELECT id FROM individual_assignments
                    WHERE assignment_id = ? AND users_id = ?
                """, (assignment_id, user_id))

                if existing_ia:
                    print(f"    Assignment already exists: {assignment_name}")
                    continue

                cur = conn.execute("""
                    INSERT INTO individual_assignments
                    (assignment_id, users_id, name, start_date, completion_date)
                    VALUES (?, ?, ?, '2026-06-08', '2026-06-13')
                """, (assignment_id, user_id, assignment_name))
                ia_id = cur.lastrowid

                # Create status records for each step
                step_ids = get_steps_for_assignment(conn, assignment_id)
                for step_id in step_ids:
                    conn.execute("""
                        INSERT OR IGNORE INTO individual_assignment_statuses
                        (individual_assignment_id, step_id, current_status)
                        VALUES (?, ?, 'Not Started')
                    """, (ia_id, step_id))

                print(f"    Created: {assignment_name} ({len(step_ids)} steps)")

        except Exception as e:
            print(f"    ERROR: {e}")
            import traceback
            traceback.print_exc()
            errors += 1
            continue

    conn.commit()
    conn.close()

    print(f"\n{'=' * 50}")
    print(f"  Import Complete!")
    print(f"  Created:  {created} new students")
    print(f"  Skipped:  {skipped} already existed")
    print(f"  Errors:   {errors}")
    print(f"{'=' * 50}")
    print(f"\nCredentials: username = full name no spaces lowercase")
    print(f"             password = same as username")

if __name__ == "__main__":
    main()
