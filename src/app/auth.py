import os
from flask import session, flash, redirect, url_for, jsonify, render_template, request, session
from werkzeug.security import generate_password_hash, check_password_hash
from itsdangerous import URLSafeTimedSerializer
from app.models import get_user_by_email, update_user_password, get_user_by_login_name, check_password_hash
from app.utils.auth_utils import get_user_roles, get_user_permission_level
import smtplib
from functools import wraps

serializer = URLSafeTimedSerializer(os.getenv("SECRET_KEY"))

def authenticate_user(form_data):
    """Handles user authentication and session setup."""
    login_name = form_data['login_name']
    password = form_data['password']

    user = get_user_by_login_name(login_name)

    if user and check_password_hash(user['password_hash'], password):
        session.clear()
        session['user_id'] = user['id']
        session['login_name'] = user['login_name']
        session['username'] = user['name']
        session['roles'] = get_user_roles(user['id'])
        session['permissions'] = get_user_permission_level(user['id'])
        session.modified = True

        # ✅ Enable 1-hour timeout (set in __init__.py)
        session.permanent = True

        return redirect(url_for('main.index'))

    flash('Incorrect username or password', 'danger')
    return render_template('login.html')


def logout():
    """Handles user logout."""
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('auth.login'))

def request_password_reset(form_data):
    """Send a password reset email if user exists."""
    email = form_data['email']
    user = get_user_by_email(email)

    if user:
        token = serializer.dumps(email, salt="password-reset")
        reset_url = url_for('auth.reset_token', token=token, _external=True)
        send_reset_email(email, reset_url)
        flash("A password reset link has been sent to your email.", "success")
    else:
        flash("No account found with that email.", "danger")

    return render_template('reset_request.html')

def reset_password(token, form_data):
    """Verify token and reset user password."""
    try:
        email = serializer.loads(token, salt="password-reset", max_age=3600)
    except:
        flash("The reset link is invalid or expired.", "danger")
        return redirect(url_for('auth.request_reset'))

    new_password = form_data['password']
    hashed_password = generate_password_hash(new_password)
    update_user_password(email, hashed_password)
    flash("Your password has been reset successfully!", "success")
    return redirect(url_for('auth.login'))

def send_reset_email(email, reset_url):
    """Send a password reset email."""
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





