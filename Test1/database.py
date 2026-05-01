import secrets
from datetime import datetime, timedelta

from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy


db = SQLAlchemy()


def _new_token():
    return secrets.token_urlsafe(32)


class Admin(UserMixin, db.Model):
    __tablename__ = "admins"

    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    opportunities = db.relationship(
        "Opportunity",
        backref="admin",
        lazy=True,
        cascade="all, delete-orphan",
    )
    students = db.relationship(
        "Student",
        backref="admin",
        lazy=True,
        cascade="all, delete-orphan",
    )
    verifiers = db.relationship(
        "Verifier",
        backref="admin",
        lazy=True,
        cascade="all, delete-orphan",
    )
    reset_tokens = db.relationship(
        "PasswordResetToken",
        backref="admin",
        lazy=True,
        cascade="all, delete-orphan",
    )

    def get_id(self):
        return str(self.id)

    def to_dict(self):
        return {
            "id": self.id,
            "full_name": self.full_name,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class Opportunity(db.Model):
    __tablename__ = "opportunities"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    duration = db.Column(db.String(50), nullable=False)
    start_date = db.Column(db.String(20), nullable=False)
    description = db.Column(db.Text, nullable=False)
    skills = db.Column(db.Text, nullable=False)
    category = db.Column(db.String(50), nullable=False)
    future_opportunities = db.Column(db.Text, nullable=False)
    max_applicants = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    admin_id = db.Column(db.Integer, db.ForeignKey("admins.id"), nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "duration": self.duration,
            "start_date": self.start_date,
            "description": self.description,
            "skills": self.skills,
            "skills_list": [s.strip() for s in self.skills.split(",") if s.strip()],
            "category": self.category,
            "future_opportunities": self.future_opportunities,
            "max_applicants": self.max_applicants,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "admin_id": self.admin_id,
        }


class Student(db.Model):
    __tablename__ = "students"

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    status = db.Column(db.String(20), nullable=False, default="pending")
    courses_enrolled = db.Column(db.Integer, nullable=False, default=0)
    certificates_count = db.Column(db.Integer, nullable=False, default=0)
    last_login_at = db.Column(db.DateTime, nullable=True)
    invite_token = db.Column(db.String(100), unique=True, nullable=False, default=_new_token)
    invite_sent_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    admin_id = db.Column(db.Integer, db.ForeignKey("admins.id"), nullable=False)

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def to_dict(self):
        return {
            "id": self.id,
            "display_id": f"#{1000 + self.id}",
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "email": self.email,
            "status": self.status,
            "courses_enrolled": self.courses_enrolled,
            "certificates_count": self.certificates_count,
            "invite_token": self.invite_token,
            "invite_sent_at": self.invite_sent_at.isoformat() if self.invite_sent_at else None,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "admin_id": self.admin_id,
        }


class Verifier(db.Model):
    __tablename__ = "verifiers"

    id = db.Column(db.Integer, primary_key=True)
    first_name = db.Column(db.String(80), nullable=False)
    last_name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    subject = db.Column(db.String(120), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="pending")
    total_students = db.Column(db.Integer, nullable=False, default=0)
    certified_students = db.Column(db.Integer, nullable=False, default=0)
    in_progress_students = db.Column(db.Integer, nullable=False, default=0)
    pending_students = db.Column(db.Integer, nullable=False, default=0)
    last_login_at = db.Column(db.DateTime, nullable=True)
    invite_token = db.Column(db.String(100), unique=True, nullable=False, default=_new_token)
    invite_sent_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
    admin_id = db.Column(db.Integer, db.ForeignKey("admins.id"), nullable=False)

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def to_dict(self):
        return {
            "id": self.id,
            "display_id": f"#V{self.id:03d}",
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "email": self.email,
            "subject": self.subject,
            "status": self.status,
            "total_students": self.total_students,
            "certified_students": self.certified_students,
            "in_progress_students": self.in_progress_students,
            "pending_students": self.pending_students,
            "invite_token": self.invite_token,
            "invite_sent_at": self.invite_sent_at.isoformat() if self.invite_sent_at else None,
            "last_login_at": self.last_login_at.isoformat() if self.last_login_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "admin_id": self.admin_id,
        }


class PasswordResetToken(db.Model):
    __tablename__ = "password_reset_tokens"

    id = db.Column(db.Integer, primary_key=True)
    token = db.Column(db.String(100), unique=True, nullable=False)
    admin_id = db.Column(db.Integer, db.ForeignKey("admins.id"), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    used = db.Column(db.Boolean, default=False)

    def __init__(self, admin_id):
        self.token = _new_token()
        self.admin_id = admin_id
        self.expires_at = datetime.utcnow() + timedelta(hours=1)

    def is_valid(self):
        return not self.used and datetime.utcnow() < self.expires_at
