import os
import smtplib
import ssl
from datetime import datetime
from email.message import EmailMessage

from flask import current_app


def _as_bool(value, default=False):
    if value is None:
        return default
    return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _app_base_url():
    return current_app.config.get("APP_BASE_URL", "http://localhost:5000").rstrip("/")


def build_reset_link(token):
    return f"{_app_base_url()}/admin.html?reset_token={token}"


def build_invitation_link(role, token):
    return f"{_app_base_url()}/invite/{role}/{token}"


def _preview_dir():
    return os.path.join(current_app.root_path, "email_previews")


def _write_preview(recipient, subject, text_body):
    os.makedirs(_preview_dir(), exist_ok=True)
    safe_recipient = recipient.replace("@", "_at_").replace(".", "_")
    timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    filename = f"{timestamp}-{safe_recipient}.txt"
    path = os.path.join(_preview_dir(), filename)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(f"To: {recipient}\n")
        handle.write(f"Subject: {subject}\n\n")
        handle.write(text_body)
    return path


def send_email(recipient, subject, text_body, html_body=None):
    host = current_app.config.get("SMTP_HOST") or os.getenv("SMTP_HOST")
    port = int(current_app.config.get("SMTP_PORT") or os.getenv("SMTP_PORT") or 587)
    username = current_app.config.get("SMTP_USERNAME") or os.getenv("SMTP_USERNAME")
    password = current_app.config.get("SMTP_PASSWORD") or os.getenv("SMTP_PASSWORD")
    sender = (
        current_app.config.get("MAIL_FROM")
        or os.getenv("MAIL_FROM")
        or username
    )
    use_tls = _as_bool(current_app.config.get("SMTP_USE_TLS") or os.getenv("SMTP_USE_TLS"), True)
    use_ssl = _as_bool(current_app.config.get("SMTP_USE_SSL") or os.getenv("SMTP_USE_SSL"), False)

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = sender or "noreply@example.com"
    message["To"] = recipient
    message.set_content(text_body)
    if html_body:
        message.add_alternative(html_body, subtype="html")

    if not host or not sender:
        preview_path = _write_preview(recipient, subject, text_body)
        return {
            "sent": False,
            "error": "SMTP is not configured. Email preview was saved locally instead.",
            "preview_path": preview_path,
        }

    try:
        if use_ssl:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(host, port, context=context, timeout=20) as server:
                if username and password:
                    server.login(username, password)
                server.send_message(message)
        else:
            with smtplib.SMTP(host, port, timeout=20) as server:
                if use_tls:
                    context = ssl.create_default_context()
                    server.starttls(context=context)
                if username and password:
                    server.login(username, password)
                server.send_message(message)
        return {"sent": True, "error": None, "preview_path": None}
    except Exception as exc:
        preview_path = _write_preview(recipient, subject, text_body)
        return {
            "sent": False,
            "error": str(exc),
            "preview_path": preview_path,
        }


def send_password_reset_email(admin):
    reset_link = build_reset_link(admin["token"])
    subject = "Reset your Qatar Foundation Admin Portal password"
    text_body = (
        f"Hello {admin['name']},\n\n"
        "We received a request to reset your password.\n"
        f"Use this link within 1 hour:\n{reset_link}\n\n"
        "If you did not request this, you can ignore this email.\n"
    )
    html_body = (
        f"<p>Hello {admin['name']},</p>"
        "<p>We received a request to reset your password.</p>"
        f"<p><a href=\"{reset_link}\">Reset your password</a></p>"
        "<p>This link expires in 1 hour.</p>"
    )
    return send_email(admin["email"], subject, text_body, html_body)


def send_student_invitation_email(student):
    invite_link = build_invitation_link("student", student.invite_token)
    subject = "Student invitation from Qatar Foundation Admin Portal"
    text_body = (
        f"Hello {student.full_name},\n\n"
        "You have been added as a student.\n"
        f"Open your invitation link here:\n{invite_link}\n\n"
        "If you were not expecting this invitation, please contact the administrator.\n"
    )
    html_body = (
        f"<p>Hello {student.full_name},</p>"
        "<p>You have been added as a student.</p>"
        f"<p><a href=\"{invite_link}\">Open your invitation</a></p>"
    )
    return send_email(student.email, subject, text_body, html_body)


def send_verifier_invitation_email(verifier):
    invite_link = build_invitation_link("verifier", verifier.invite_token)
    subject = "Verifier invitation from Qatar Foundation Admin Portal"
    text_body = (
        f"Hello {verifier.full_name},\n\n"
        "You have been added as a verifier.\n"
        f"Open your invitation link here:\n{invite_link}\n\n"
        "If you were not expecting this invitation, please contact the administrator.\n"
    )
    html_body = (
        f"<p>Hello {verifier.full_name},</p>"
        "<p>You have been added as a verifier.</p>"
        f"<p><a href=\"{invite_link}\">Open your invitation</a></p>"
    )
    return send_email(verifier.email, subject, text_body, html_body)


def send_opportunity_email(student, opportunity, action="created"):
    is_update = action == "updated"
    action_label = "updated" if is_update else "created"
    subject_prefix = "Opportunity updated" if is_update else "New opportunity available"
    portal_link = f"{_app_base_url()}/admin.html"

    subject = f"{subject_prefix}: {opportunity.name}"
    text_body = (
        f"Hello {student.full_name},\n\n"
        f"A training opportunity has been {action_label} for you.\n\n"
        f"Title: {opportunity.name}\n"
        f"Category: {opportunity.category}\n"
        f"Duration: {opportunity.duration}\n"
        f"Start date: {opportunity.start_date}\n"
        f"Description: {opportunity.description}\n"
        f"Skills: {opportunity.skills}\n"
        f"Future opportunities: {opportunity.future_opportunities}\n\n"
        f"Open the portal here:\n{portal_link}\n"
    )
    html_body = (
        f"<p>Hello {student.full_name},</p>"
        f"<p>A training opportunity has been {action_label} for you.</p>"
        f"<p><strong>Title:</strong> {opportunity.name}<br>"
        f"<strong>Category:</strong> {opportunity.category}<br>"
        f"<strong>Duration:</strong> {opportunity.duration}<br>"
        f"<strong>Start date:</strong> {opportunity.start_date}</p>"
        f"<p><a href=\"{portal_link}\">Open the admin portal</a></p>"
    )
    return send_email(student.email, subject, text_body, html_body)
