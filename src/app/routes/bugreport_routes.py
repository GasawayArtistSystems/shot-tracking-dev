from flask import Blueprint, request, jsonify, render_template, current_app
from app.models.bug_report import BugReport
import smtplib
from email.mime.text import MIMEText


bugreport_bp = Blueprint('bugreport', __name__)


# The admin UI (bug_reports.html) and the React form both call these under a
# /bugreport/... prefix, but the blueprint is mounted without a url_prefix
# (and base.html links straight to /bugs). Rather than move the prefix and
# chase every caller, each view answers at both paths.
@bugreport_bp.route('/bugs', methods=['GET', 'POST'])
@bugreport_bp.route('/bugreport/bugs', methods=['GET'])
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




@bugreport_bp.route('/bugreport/bugs', methods=['POST'])
@bugreport_bp.route('/bugreport/submit', methods=['POST'])
def submit_bug_report():
    """Alias endpoints for the React bug/feature form.

    The blueprint is mounted without a url_prefix, so its list/admin routes
    live at /bugs. The front-end bundle (both the current source and the
    older deployed build) POSTs to /bugreport/bugs and /bugreport/submit
    respectively -- neither of which existed, so every submission 404'd and
    the form choked trying to JSON-parse the HTML 404 page. Accept both.
    """
    data = request.get_json(silent=True) or {}
    current_app.logger.info("Bug report payload: %r", data)
    try:
        BugReport.insert(data)
        current_app.logger.info("Bug report saved to DB")
        return jsonify({"ok": True, "saved": True}), 200
    except Exception as e:
        current_app.logger.exception("Bug report insert failed")
        return jsonify({"ok": False, "error": str(e)}), 500


@bugreport_bp.route('/bugs/resolve/<int:bug_id>', methods=['POST'])
@bugreport_bp.route('/bugreport/bugs/resolve/<int:bug_id>', methods=['POST'])
def resolve_bug(bug_id):
    try:
        BugReport.mark_resolved(bug_id)  # <- update directly
        return jsonify({"success": True, "message": "Bug marked as resolved."}), 200
    except Exception as e:
        current_app.logger.error(f"âŒ Error resolving bug {bug_id}: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@bugreport_bp.route('/bugs/archive/<int:bug_id>', methods=['POST'])
@bugreport_bp.route('/bugreport/bugs/archive/<int:bug_id>', methods=['POST'])
def archive_bug(bug_id):
    try:
        BugReport.archive(bug_id)  # sets status to 'Archived'
        return jsonify({"success": True, "message": "Bug archived."}), 200
    except Exception as e:
        current_app.logger.error(f"❌ Error archiving bug {bug_id}: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@bugreport_bp.route('/bugs/delete/<int:bug_id>', methods=['POST'])
@bugreport_bp.route('/bugreport/bugs/delete/<int:bug_id>', methods=['POST'])
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



