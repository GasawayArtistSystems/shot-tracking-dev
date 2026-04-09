from flask import Blueprint, request, jsonify, render_template, current_app
from app.models.bug_report import BugReport
import smtplib
from email.mime.text import MIMEText


bugreport_bp = Blueprint('bugreport', __name__)


@bugreport_bp.route('/bugs', methods=['GET', 'POST'])
def bug_reports():
    if request.method == 'GET':
        status = request.args.get('status', 'All')
        try:
            if status and status != 'All':
                bugs = BugReport.get_by_status(status)
            else:
                bugs = BugReport.get_all() or []
            return render_template('bug_reports.html', bugs=bugs, current_status=status)
        except Exception as e:
            current_app.logger.exception("❌ Error in /bugs GET")
            return jsonify({"error": "Failed to render bug reports", "details": str(e)}), 500

    # --- POST: add a new bug report ---
    data = request.get_json(silent=True) or {}
    current_app.logger.info("Bug report payload: %r", data)

    try:
        BugReport.insert(data)
        current_app.logger.info("Bug report saved to DB")
        return jsonify({"ok": True, "saved": True, "echo": data}), 200
    except Exception as e:
        current_app.logger.exception("DB insert failed")
        return jsonify({"ok": False, "error": str(e)}), 500




@bugreport_bp.route('/bugs/resolve/<int:bug_id>', methods=['POST'])
def resolve_bug(bug_id):
    try:
        BugReport.mark_resolved(bug_id)  # <- update directly
        return jsonify({"success": True, "message": "Bug marked as resolved."}), 200
    except Exception as e:
        current_app.logger.error(f"âŒ Error resolving bug {bug_id}: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@bugreport_bp.route('/bugs/archive/<int:bug_id>', methods=['POST'])
def archive_bug(bug_id):
    try:
        BugReport.archive(bug_id)  # sets status to 'Archived'
        return jsonify({"success": True, "message": "Bug archived."}), 200
    except Exception as e:
        current_app.logger.error(f"❌ Error archiving bug {bug_id}: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@bugreport_bp.route('/bugs/delete/<int:bug_id>', methods=['POST'])
def delete_bug(bug_id):
    try:
        BugReport.delete(bug_id)  # permanently remove
        return jsonify({"success": True, "message": "Bug deleted."}), 200
    except Exception as e:
        current_app.logger.error(f"❌ Error deleting bug {bug_id}: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


def send_bug_report_email(subject, body):
    """Send the bug report via email using SMTP."""
    sender_email = "00gasman00@gmail.com"  # Change this!
    receiver_email = "00gasman00@gmail.com"  # Where YOU receive bug reports
    password = "erdokaqemqromufx"  # App password or real password

    # Build the MIME message
    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = sender_email
    msg["To"] = receiver_email

    # Connect and send email securely
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:  # Use your SMTP provider
        server.login(sender_email, password)
        server.sendmail(sender_email, receiver_email, msg.as_string())



