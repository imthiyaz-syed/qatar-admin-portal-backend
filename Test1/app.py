import os
from datetime import timedelta

from flask import Flask, send_from_directory
from flask_cors import CORS
from flask_login import LoginManager
from werkzeug.security import generate_password_hash

from auth import auth_bp
from database import Admin, db
from opportunities import opportunities_bp
from people import people_bp


BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def load_dotenv_file(dotenv_path):
    """Load simple KEY=VALUE pairs from a local .env file if present."""
    if not os.path.exists(dotenv_path):
        return

    with open(dotenv_path, "r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value


load_dotenv_file(os.path.join(BASE_DIR, ".env"))

app = Flask(__name__, static_folder="sky", static_url_path="")
app.config["SECRET_KEY"] = "qf-admin-portal-secret-key-2026"
app.config["SQLALCHEMY_DATABASE_URI"] = (
    f"sqlite:///{os.path.join(BASE_DIR, 'qf_admin.db')}"
)
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["REMEMBER_COOKIE_DURATION"] = timedelta(days=30)
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=30)
app.config["SESSION_PERMANENT"] = False
app.config["APP_BASE_URL"] = os.getenv("APP_BASE_URL", "http://localhost:5000")
app.config["SMTP_HOST"] = os.getenv("SMTP_HOST")
app.config["SMTP_PORT"] = os.getenv("SMTP_PORT", "587")
app.config["SMTP_USERNAME"] = os.getenv("SMTP_USERNAME")
app.config["SMTP_PASSWORD"] = os.getenv("SMTP_PASSWORD")
app.config["MAIL_FROM"] = os.getenv("MAIL_FROM")
app.config["SMTP_USE_TLS"] = os.getenv("SMTP_USE_TLS", "true")
app.config["SMTP_USE_SSL"] = os.getenv("SMTP_USE_SSL", "false")

CORS(app, supports_credentials=True)
db.init_app(app)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = None


@login_manager.user_loader
def load_user(user_id):
    return Admin.query.get(int(user_id))


app.register_blueprint(auth_bp)
app.register_blueprint(opportunities_bp)
app.register_blueprint(people_bp)


@app.route("/")
@app.route("/admin.html")
def serve_index():
    return send_from_directory("sky", "admin.html")


@app.route("/admin.css")
def serve_css():
    return send_from_directory("sky", "admin.css")


@app.route("/admin.js")
def serve_js():
    return send_from_directory("sky", "admin.js")


@app.route("/<path:path>")
def serve_static(path):
    file_path = os.path.join("sky", path)
    if os.path.exists(file_path):
        return send_from_directory("sky", path)
    return "File not found", 404


def init_db():
    """Create tables and seed a default admin account for local testing."""
    with app.app_context():
        db.create_all()

        default_email = "admin@qf.org.qa"
        default_password = "admin123"

        if not Admin.query.filter_by(email=default_email).first():
            default_admin = Admin(
                full_name="System Administrator",
                email=default_email,
                password_hash=generate_password_hash(default_password),
            )
            db.session.add(default_admin)
            db.session.commit()
            print(
                "Default admin created "
                f"(email: {default_email}, password: {default_password})"
            )

        print("Database tables are ready.")
        if not app.config["SMTP_HOST"]:
            print(
                "Optional SMTP is not configured. Any non-core invitation previews "
                f"will be saved to {os.path.join(BASE_DIR, 'email_previews')} instead of being sent."
            )


if __name__ == "__main__":
    init_db()

    print("\n" + "=" * 60)
    print("Qatar Foundation Admin Portal")
    print(f"Base Directory: {BASE_DIR}")
    print(f"Sky Folder: {os.path.join(BASE_DIR, 'sky')}")
    print("Access at: http://localhost:5000")
    print("Default login: admin@qf.org.qa / admin123")
    print("=" * 60 + "\n")

    app.run(debug=True, host="0.0.0.0", port=5000)
