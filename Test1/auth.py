import os
import re
from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, request, session
from flask_login import current_user, login_required, login_user, logout_user
from sqlalchemy import func
from werkzeug.security import check_password_hash, generate_password_hash

from database import Admin, PasswordResetToken, db


auth_bp = Blueprint("auth", __name__)


def is_valid_email(email):
    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email) is not None


def find_admin_by_email(email):
    normalized = email.strip().lower()
    if not normalized:
        return None
    return Admin.query.filter(func.lower(Admin.email) == normalized).first()


def _reset_log_path():
    return os.path.join(current_app.root_path, "reset_link_logs.txt")


def log_reset_link(admin, token):
    reset_link = (
        f"{current_app.config.get('APP_BASE_URL', 'http://localhost:5000').rstrip('/')}"
        f"/admin.html?reset_token={token}"
    )
    timestamp = datetime.utcnow().isoformat()
    log_line = (
        f"[{timestamp}] admin_id={admin.id} email={admin.email} "
        f"reset_link={reset_link}\n"
    )

    with open(_reset_log_path(), "a", encoding="utf-8") as handle:
        handle.write(log_line)

    print(f"Password reset link generated for {admin.email}: {reset_link}")


@auth_bp.route("/api/signup", methods=["POST"])
def signup():
    """US-1.1: Admin Sign Up"""
    data = request.get_json(silent=True) or {}

    full_name = data.get("full_name", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    confirm_password = data.get("confirm_password", "")

    if not all([full_name, email, password, confirm_password]):
        return jsonify({"success": False, "error": "All fields are required"}), 400

    if not is_valid_email(email):
        return jsonify({"success": False, "error": "Invalid email format"}), 400

    if len(password) < 8:
        return jsonify({"success": False, "error": "Password must be at least 8 characters"}), 400

    if password != confirm_password:
        return jsonify({"success": False, "error": "Passwords do not match"}), 400

    existing_admin = find_admin_by_email(email)
    if existing_admin:
        return jsonify({"success": False, "error": "Account already exists with this email"}), 409

    new_admin = Admin(
        full_name=full_name,
        email=email,
        password_hash=generate_password_hash(password),
    )

    db.session.add(new_admin)
    db.session.commit()

    return jsonify({"success": True, "message": "Account created successfully"}), 201


@auth_bp.route("/api/login", methods=["POST"])
def login():
    """US-1.2: Admin Login"""
    data = request.get_json(silent=True) or {}

    email = data.get("email", "").strip().lower()
    password = data.get("password", "")
    remember_me = data.get("remember_me", False)

    if not email or not password:
        return jsonify({"success": False, "error": "Invalid email or password"}), 401

    admin = find_admin_by_email(email)

    if not admin or not check_password_hash(admin.password_hash, password):
        return jsonify({"success": False, "error": "Invalid email or password"}), 401

    login_user(admin, remember=remember_me)

    if remember_me:
        session.permanent = True
        session.permanent_session_lifetime = timedelta(days=30)

    opportunities = [opp.to_dict() for opp in admin.opportunities]

    return jsonify(
        {
            "success": True,
            "message": "Login successful",
            "admin": admin.to_dict(),
            "opportunities": opportunities,
        }
    ), 200


@auth_bp.route("/api/logout", methods=["POST"])
@login_required
def logout():
    logout_user()
    return jsonify({"success": True, "message": "Logged out successfully"}), 200


@auth_bp.route("/api/forgot-password", methods=["POST"])
def forgot_password():
    """US-1.3: Forgot Password"""
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower()

    success_message = {
        "success": True,
        "message": "If an account exists with this email, a reset link has been generated",
    }

    if not email or not is_valid_email(email):
        return jsonify(success_message), 200

    admin = find_admin_by_email(email)

    if admin:
        PasswordResetToken.query.filter_by(admin_id=admin.id, used=False).delete()
        new_token = PasswordResetToken(admin.id)
        db.session.add(new_token)
        db.session.commit()
        log_reset_link(admin, new_token.token)

    return jsonify(success_message), 200


@auth_bp.route("/api/reset-password", methods=["POST"])
def reset_password():
    data = request.get_json(silent=True) or {}
    token = data.get("token", "")
    new_password = data.get("new_password", "")
    confirm_password = data.get("confirm_password", "")

    if len(new_password) < 8:
        return jsonify({"success": False, "error": "Password must be at least 8 characters"}), 400

    if new_password != confirm_password:
        return jsonify({"success": False, "error": "Passwords do not match"}), 400

    reset_token = PasswordResetToken.query.filter_by(token=token, used=False).first()

    if not reset_token or not reset_token.is_valid():
        return jsonify({"success": False, "error": "Reset link has expired or is invalid"}), 400

    admin = Admin.query.get(reset_token.admin_id)
    admin.password_hash = generate_password_hash(new_password)
    reset_token.used = True

    db.session.commit()

    return jsonify({"success": True, "message": "Password reset successfully"}), 200


@auth_bp.route("/api/me", methods=["GET"])
@login_required
def get_current_admin():
    return jsonify({"success": True, "admin": current_user.to_dict()}), 200


@auth_bp.route("/api/check-session", methods=["GET"])
def check_session():
    if current_user.is_authenticated:
        opportunities = [opp.to_dict() for opp in current_user.opportunities]
        return jsonify(
            {
                "authenticated": True,
                "admin": current_user.to_dict(),
                "opportunities": opportunities,
            }
        ), 200
    return jsonify({"authenticated": False}), 200
