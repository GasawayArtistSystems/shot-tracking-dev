from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, session
from app.models import (
    get_all_user_groups,
    add_user_group,
    delete_user_group,
    get_unarchived_classes,
    get_unarchived_films
)


from app.utils.utils import role_required
from app.routes.classes_routes import classes_bp
from app.utils.auth_utils import login_required, admin_required
from app.database.db import get_db
from app.models.user_model import User


admin_bp = Blueprint('admin', __name__, template_folder='../templates/admin')

@admin_bp.route('/settings/user_groups', methods=['GET', 'POST'])
@admin_required 
def manage_user_groups():
    """Manage user groups."""
    if request.method == 'POST':
        if "group_name" in request.form:
            group_name = request.form.get("group_name")
            section = request.form.get("section", "classes")
            print(f"[DEBUG] Adding user group: {group_name}")

            try:
                add_user_group(group_name, section)
                flash("User group added successfully!", "success")
            except Exception as e:
                print(f"[ERROR] add_user_group failed: {e}")
                flash(f"Error adding group: {e}", "danger")

        elif "group_id" in request.form:
            group_id = request.form.get("group_id")
            try:
                delete_user_group(group_id)
                flash("User group deleted successfully!", "success")
            except Exception as e:
                flash(f"Error deleting group: {e}", "danger")

        return redirect(url_for('admin.manage_user_groups'))

    user_groups = get_all_user_groups()
    print("[DEBUG] Current groups:", user_groups)
    return render_template(
        'admin/settings_user_groups.html',
        user_groups=user_groups,
        active_tab='user_groups'
    )


@admin_bp.route('/settings')
@login_required
@role_required('classes', ['Admin'])  # [OK] Fix: Provide correct parameters
def admin_settings():
    return render_template('admin/settings.html')

@admin_bp.route('/archive/classes', methods=['GET', 'POST'], endpoint='archive_classes')
@admin_required 
def archive_classes():
    if request.method == 'POST':
        class_ids = request.form.getlist('class_ids')
        conn = get_db()
        try:
            with conn:
                conn.executemany("UPDATE classes SET archived = 1 WHERE id = ?", [(cid,) for cid in class_ids])
            flash('Selected classes have been archived.', 'success')
        except Exception as e:
            flash(f"Error archiving classes: {e}", 'danger')
        return redirect(url_for('admin.archive_classes'))
    
    # Fetch unarchived classes
    unarchived_classes = get_unarchived_classes()
    return render_template('admin/archive_classes.html', all_classes=unarchived_classes)

@admin_bp.route('/archive/users', methods=['GET', 'POST'], endpoint='archive_users')
@admin_required 
def archive_users():
    if request.method == 'POST':
        user_ids = request.form.getlist('user_ids')
        conn = get_db()
        try:
            with conn:
                conn.executemany("UPDATE users SET archived = 1 WHERE id = ?", [(uid,) for uid in user_ids])
            flash('Selected users have been archived.', 'success')
        except Exception as e:
            flash(f"Error archiving users: {e}", 'danger')
        return redirect(url_for('admin.archive_users'))
    
    # Fetch users not in active classes
    students_not_in_classes = User.get_not_in_any_active_class()
    return render_template('admin/archive_users.html', students_not_in_classes=students_not_in_classes)

@admin_bp.route('/archive/films', methods=['GET', 'POST'], endpoint='archive_films')
@admin_required 
def archive_films():
    """View and archive films."""
    if request.method == 'POST':
        film_ids = request.form.getlist('film_ids')
        conn = get_db()
        try:
            with conn:
                conn.executemany("UPDATE films SET archived = 1 WHERE id = ?", [(fid,) for fid in film_ids])
            flash('Selected films have been archived.', 'success')
        except Exception as e:
            flash(f"Error archiving films: {e}", 'danger')
        return redirect(url_for('admin.archive_films'))
    
    # Fetch unarchived films
    unarchived_films = get_unarchived_films()
    return render_template('admin/archive_films.html', films_to_archive=unarchived_films)


@admin_bp.route("/api/students")
@login_required
def get_all_students():
    roles = session.get("roles", [])
    if "admin" not in [r.lower() for r in roles]:
        return jsonify({"error": "Unauthorized"}), 403

    conn = get_db()
    rows = conn.execute("""
        SELECT id, name FROM users
        WHERE id IN (SELECT user_id FROM user_groups)
        ORDER BY name
    """).fetchall()

    return jsonify([dict(row) for row in rows])



