from flask import Blueprint, render_template, redirect, url_for, send_from_directory, session
from app.utils.auth_utils import login_required
from app.routes.auth_routes import logout_route
from app.routes.auth_routes import login as login_route


import os

main_bp = Blueprint('main', __name__)

@main_bp.route('/')
def home():
    if 'user_id' in session:
        return redirect(url_for('main.index'))
    return render_template('landing.html')

@main_bp.route('/login')
def login():
    """Redirect to the login page."""
    return login_route()

@main_bp.route('/logout')
def user_logout():
    """Handles user logout from main routes."""
    return logout_route()

# Serve JavaScript files
@main_bp.route('/static/js/<path:filename>')
def serve_js(filename):
    return send_from_directory(os.path.join(os.path.dirname(__file__), '../../static/js'), filename, mimetype='application/javascript')

@main_bp.route('/static/components/<path:filename>')
def serve_components(filename):
    return send_from_directory(os.path.join(os.path.dirname(__file__), '../../static/components'), filename, mimetype='application/javascript')

@main_bp.route('/', methods=['GET'])
@main_bp.route('/index', methods=['GET'])  # [OK] Ensure `/index` triggers the same logic
@login_required
def index():
    """Redirect Admins & Instructors to index.html, others to dashboard.html."""
    
    # [OK] Get user roles from session
    user_roles = session.get('roles', {})


    # [OK] Admins & Instructors go to index.html
    if ('classes' in user_roles and user_roles['classes'] in ['Admin', 'Instructor']) or \
       ('films' in user_roles and user_roles['films'] in ['Admin', 'Instructor']):
        return render_template('index.html')

    # [OK] All others go to dashboard.html
    return redirect(url_for('dashboard.dashboard_home'))



