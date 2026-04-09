from flask import Blueprint, render_template, request, flash, redirect, url_for, session
from werkzeug.security import generate_password_hash
from itsdangerous import URLSafeTimedSerializer
from app.models import get_user_by_email, update_user_password, get_user_by_login_name
from app.utils.auth_utils import login_required
from app.auth import logout, authenticate_user 
import smtplib
import os

auth_bp = Blueprint('auth', __name__)
serializer = URLSafeTimedSerializer(os.getenv("SECRET_KEY", "dev-secret-key"))

@auth_bp.route('/reset-password', methods=['GET', 'POST'])
def request_reset():
    """Step 1: Ask user for their email to send a password reset link."""
    if request.method == 'POST':
        email = request.form['email']
        user = get_user_by_email(email)

        if user:
            token = serializer.dumps(email, salt="password-reset")
            reset_url = url_for('auth.reset_token', token=token, _external=True)
            send_reset_email(email, reset_url)
            flash("A password reset link has been sent to your email.", "success")
        else:
            flash("No account found with that email.", "danger")

    return render_template('reset_request.html')

@auth_bp.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_token(token):
    """Step 2: Verify token and let user reset their password."""
    try:
        email = serializer.loads(token, salt="password-reset", max_age=3600)
    except:
        flash("The reset link is invalid or expired.", "danger")
        return redirect(url_for('auth.request_reset'))

    if request.method == 'POST':
        new_password = request.form['password']
        hashed_password = generate_password_hash(new_password)
        update_user_password(email, hashed_password)
        flash("Your password has been reset successfully!", "success")
        return redirect(url_for('auth.login'))

    return render_template('reset_password.html', token=token)

def send_reset_email(email, reset_url):
    """Send password reset email using SMTP."""
    sender_email = os.getenv("MAIL_USERNAME")
    sender_password = os.getenv("MAIL_PASSWORD")
    smtp_server = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    smtp_port = int(os.getenv("MAIL_PORT", 587))

    subject = "Password Reset Request"
    body = f"Click the link below to reset your password:\n{reset_url}"

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            message = f"Subject: {subject}\n\n{body}"
            server.sendmail(sender_email, email, message)
        print(f"[OK] Reset email sent to {email}")
    except Exception as e:
        print(f"âŒ Error sending email: {e}")

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        try:
            return authenticate_user(request.form)
        except Exception as e:
            flash(str(e), 'danger')

    return render_template('login.html')

@auth_bp.route('/logout')
def logout_route():
    """Handles user logout via route."""
    return logout()



