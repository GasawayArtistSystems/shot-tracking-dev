import os
from flask import Blueprint, request, jsonify, render_template
from werkzeug.utils import secure_filename

video_bp = Blueprint("video", __name__, url_prefix="/video")

ALLOWED_EXTENSIONS = {"webm", "mp4", "mov", "avi"}

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS




