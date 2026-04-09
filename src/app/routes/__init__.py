from flask import Blueprint, render_template, jsonify
from .admin_routes import admin_bp
from .assignments_routes import assignments_bp
from .classes_routes import classes_bp
from .users_routes import users_bp
from .workflow_routes import workflow_routes
from app.routes.review_routes import review_routes



