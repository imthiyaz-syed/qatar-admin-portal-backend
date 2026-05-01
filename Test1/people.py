from datetime import datetime

from flask import Blueprint, jsonify, render_template_string, request
from flask_login import current_user, login_required

from database import Student, Verifier, db
from notifications import send_student_invitation_email, send_verifier_invitation_email


people_bp = Blueprint("people", __name__)

VALID_STATUSES = {"active", "inactive", "pending", "deactivated"}


def _clean_text(data, key):
    return str(data.get(key, "")).strip()


def _is_valid_email(email):
    return "@" in email and "." in email.split("@")[-1]


def _student_payload(row):
    return {
        "first_name": _clean_text(row, "first_name"),
        "last_name": _clean_text(row, "last_name"),
        "email": _clean_text(row, "email").lower(),
    }


def _verifier_payload(row):
    return {
        "first_name": _clean_text(row, "first_name"),
        "last_name": _clean_text(row, "last_name"),
        "email": _clean_text(row, "email").lower(),
        "subject": _clean_text(row, "subject"),
    }


def _validate_student_payload(payload):
    if not payload["first_name"] or not payload["last_name"] or not payload["email"]:
        return "First name, last name, and email are required."
    if not _is_valid_email(payload["email"]):
        return "Invalid student email address."
    return None


def _validate_verifier_payload(payload):
    if (
        not payload["first_name"]
        or not payload["last_name"]
        or not payload["email"]
        or not payload["subject"]
    ):
        return "First name, last name, email, and subject are required."
    if not _is_valid_email(payload["email"]):
        return "Invalid verifier email address."
    return None


def _delivery_message(entity_name, delivery_result):
    if delivery_result["sent"]:
        return f"{entity_name} saved and invitation email sent."
    return (
        f"{entity_name} saved, but the invitation email was not delivered. "
        f"{delivery_result['error']}"
    )


@people_bp.route("/api/students", methods=["GET"])
@login_required
def get_students():
    students = (
        Student.query.filter_by(admin_id=current_user.id)
        .order_by(Student.created_at.desc())
        .all()
    )
    return jsonify({"success": True, "students": [student.to_dict() for student in students]}), 200


@people_bp.route("/api/students", methods=["POST"])
@login_required
def create_student():
    data = request.get_json(silent=True) or {}
    payload = _student_payload(data)
    error = _validate_student_payload(payload)
    if error:
        return jsonify({"success": False, "error": error}), 400

    existing_student = Student.query.filter_by(email=payload["email"]).first()
    if existing_student:
        return jsonify({"success": False, "error": "A student with this email already exists."}), 409

    student = Student(
        first_name=payload["first_name"],
        last_name=payload["last_name"],
        email=payload["email"],
        status="pending",
        invite_sent_at=datetime.utcnow(),
        admin_id=current_user.id,
    )
    db.session.add(student)
    db.session.commit()

    delivery = send_student_invitation_email(student)
    return jsonify(
        {
            "success": True,
            "message": _delivery_message("Student", delivery),
            "email_sent": delivery["sent"],
            "student": student.to_dict(),
        }
    ), 201


@people_bp.route("/api/students/bulk", methods=["POST"])
@login_required
def bulk_create_students():
    data = request.get_json(silent=True) or {}
    rows = data.get("students") or []
    if not isinstance(rows, list) or not rows:
        return jsonify({"success": False, "error": "No student rows were provided."}), 400

    created_students = []
    skipped = []
    seen_emails = set()

    for index, row in enumerate(rows, start=1):
        payload = _student_payload(row)
        error = _validate_student_payload(payload)
        if error:
            skipped.append(f"Row {index}: {error}")
            continue
        if payload["email"] in seen_emails:
            skipped.append(f"Row {index}: {payload['email']} is duplicated in the upload.")
            continue
        if Student.query.filter_by(email=payload["email"]).first():
            skipped.append(f"Row {index}: {payload['email']} already exists.")
            continue

        student = Student(
            first_name=payload["first_name"],
            last_name=payload["last_name"],
            email=payload["email"],
            status="pending",
            invite_sent_at=datetime.utcnow(),
            admin_id=current_user.id,
        )
        db.session.add(student)
        created_students.append(student)
        seen_emails.add(payload["email"])

    if not created_students:
        return jsonify({"success": False, "error": "No valid students were uploaded.", "skipped": skipped}), 400

    db.session.commit()

    sent_count = 0
    delivery_errors = []
    for student in created_students:
        delivery = send_student_invitation_email(student)
        if delivery["sent"]:
            sent_count += 1
        else:
            delivery_errors.append(f"{student.email}: {delivery['error']}")

    return jsonify(
        {
            "success": True,
            "message": (
                f"{len(created_students)} students saved. "
                f"Invitation emails sent: {sent_count}. "
                f"Skipped: {len(skipped)}."
            ),
            "created": len(created_students),
            "sent": sent_count,
            "skipped": skipped,
            "delivery_errors": delivery_errors,
            "students": [student.to_dict() for student in created_students],
        }
    ), 201


@people_bp.route("/api/verifiers", methods=["GET"])
@login_required
def get_verifiers():
    verifiers = (
        Verifier.query.filter_by(admin_id=current_user.id)
        .order_by(Verifier.created_at.desc())
        .all()
    )
    return jsonify({"success": True, "verifiers": [verifier.to_dict() for verifier in verifiers]}), 200


@people_bp.route("/api/verifiers", methods=["POST"])
@login_required
def create_verifier():
    data = request.get_json(silent=True) or {}
    payload = _verifier_payload(data)
    error = _validate_verifier_payload(payload)
    if error:
        return jsonify({"success": False, "error": error}), 400

    existing_verifier = Verifier.query.filter_by(email=payload["email"]).first()
    if existing_verifier:
        return jsonify({"success": False, "error": "A verifier with this email already exists."}), 409

    verifier = Verifier(
        first_name=payload["first_name"],
        last_name=payload["last_name"],
        email=payload["email"],
        subject=payload["subject"],
        status="pending",
        invite_sent_at=datetime.utcnow(),
        admin_id=current_user.id,
    )
    db.session.add(verifier)
    db.session.commit()

    delivery = send_verifier_invitation_email(verifier)
    return jsonify(
        {
            "success": True,
            "message": _delivery_message("Verifier", delivery),
            "email_sent": delivery["sent"],
            "verifier": verifier.to_dict(),
        }
    ), 201


@people_bp.route("/api/verifiers/bulk", methods=["POST"])
@login_required
def bulk_create_verifiers():
    data = request.get_json(silent=True) or {}
    rows = data.get("verifiers") or []
    if not isinstance(rows, list) or not rows:
        return jsonify({"success": False, "error": "No verifier rows were provided."}), 400

    created_verifiers = []
    skipped = []
    seen_emails = set()

    for index, row in enumerate(rows, start=1):
        payload = _verifier_payload(row)
        error = _validate_verifier_payload(payload)
        if error:
            skipped.append(f"Row {index}: {error}")
            continue
        if payload["email"] in seen_emails:
            skipped.append(f"Row {index}: {payload['email']} is duplicated in the upload.")
            continue
        if Verifier.query.filter_by(email=payload["email"]).first():
            skipped.append(f"Row {index}: {payload['email']} already exists.")
            continue

        verifier = Verifier(
            first_name=payload["first_name"],
            last_name=payload["last_name"],
            email=payload["email"],
            subject=payload["subject"],
            status="pending",
            invite_sent_at=datetime.utcnow(),
            admin_id=current_user.id,
        )
        db.session.add(verifier)
        created_verifiers.append(verifier)
        seen_emails.add(payload["email"])

    if not created_verifiers:
        return jsonify({"success": False, "error": "No valid verifiers were uploaded.", "skipped": skipped}), 400

    db.session.commit()

    sent_count = 0
    delivery_errors = []
    for verifier in created_verifiers:
        delivery = send_verifier_invitation_email(verifier)
        if delivery["sent"]:
            sent_count += 1
        else:
            delivery_errors.append(f"{verifier.email}: {delivery['error']}")

    return jsonify(
        {
            "success": True,
            "message": (
                f"{len(created_verifiers)} verifiers saved. "
                f"Invitation emails sent: {sent_count}. "
                f"Skipped: {len(skipped)}."
            ),
            "created": len(created_verifiers),
            "sent": sent_count,
            "skipped": skipped,
            "delivery_errors": delivery_errors,
            "verifiers": [verifier.to_dict() for verifier in created_verifiers],
        }
    ), 201


@people_bp.route("/invite/<role>/<token>", methods=["GET"])
def accept_invitation(role, token):
    if role == "student":
        record = Student.query.filter_by(invite_token=token).first()
    elif role == "verifier":
        record = Verifier.query.filter_by(invite_token=token).first()
    else:
        record = None

    if not record:
        return "Invitation not found or expired.", 404

    if record.status in VALID_STATUSES and record.status == "pending":
        record.status = "active"
        db.session.commit()

    return render_template_string(
        """
        <!doctype html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <title>Invitation Accepted</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
                body { font-family: Arial, sans-serif; background: #f3f8f6; margin: 0; padding: 32px; color: #17322a; }
                .card { max-width: 640px; margin: 0 auto; background: white; border-radius: 18px; padding: 32px; box-shadow: 0 12px 30px rgba(0,0,0,0.08); }
                a { color: #0f7b6c; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>Invitation confirmed</h1>
                <p>{{ full_name }} has been marked as active.</p>
                <p>Email: {{ email }}</p>
                <p>You can now return to the portal.</p>
                <p><a href="/admin.html">Open the admin portal</a></p>
            </div>
        </body>
        </html>
        """,
        full_name=record.full_name,
        email=record.email,
    )
