from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from database import Opportunity, db


opportunities_bp = Blueprint("opportunities", __name__)

VALID_CATEGORIES = [
    "Technology",
    "Business",
    "Design",
    "Marketing",
    "Data Science",
    "Other",
]


def _parse_opportunity_payload(data):
    return {
        "name": str(data.get("name", "")).strip(),
        "duration": str(data.get("duration", "")).strip(),
        "start_date": str(data.get("start_date", "")).strip(),
        "description": str(data.get("description", "")).strip(),
        "skills": str(data.get("skills", "")).strip(),
        "category": str(data.get("category", "")).strip(),
        "future_opportunities": str(data.get("future_opportunities", "")).strip(),
        "max_applicants": data.get("max_applicants"),
    }


def _validate_opportunity_payload(payload):
    required_fields = [
        payload["name"],
        payload["duration"],
        payload["start_date"],
        payload["description"],
        payload["skills"],
        payload["category"],
        payload["future_opportunities"],
    ]
    if not all(required_fields):
        return "All required fields must be filled"

    if payload["category"] not in VALID_CATEGORIES:
        return "Invalid category"

    return None


def _normalize_max_applicants(value):
    if value in (None, "", "null"):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


@opportunities_bp.route("/api/opportunities", methods=["GET"])
@login_required
def get_opportunities():
    """US-2.1: View all opportunities created by the logged-in admin."""
    opportunities = (
        Opportunity.query.filter_by(admin_id=current_user.id)
        .order_by(Opportunity.created_at.desc())
        .all()
    )
    return jsonify(
        {"success": True, "opportunities": [opp.to_dict() for opp in opportunities]}
    ), 200


@opportunities_bp.route("/api/opportunities", methods=["POST"])
@login_required
def create_opportunity():
    """US-2.2: Create a new opportunity tied to the logged-in admin."""
    data = request.get_json(silent=True) or {}
    payload = _parse_opportunity_payload(data)

    error = _validate_opportunity_payload(payload)
    if error:
        return jsonify({"success": False, "error": error}), 400

    new_opportunity = Opportunity(
        name=payload["name"],
        duration=payload["duration"],
        start_date=payload["start_date"],
        description=payload["description"],
        skills=payload["skills"],
        category=payload["category"],
        future_opportunities=payload["future_opportunities"],
        max_applicants=_normalize_max_applicants(payload["max_applicants"]),
        admin_id=current_user.id,
    )

    db.session.add(new_opportunity)
    db.session.commit()

    return jsonify(
        {
            "success": True,
            "message": "Opportunity created successfully",
            "opportunity": new_opportunity.to_dict(),
        }
    ), 201


@opportunities_bp.route("/api/opportunities/<int:opp_id>", methods=["GET"])
@login_required
def get_opportunity(opp_id):
    """US-2.4: Fetch one opportunity owned by the logged-in admin."""
    opportunity = Opportunity.query.filter_by(
        id=opp_id, admin_id=current_user.id
    ).first()

    if not opportunity:
        return jsonify({"success": False, "error": "Opportunity not found"}), 404

    return jsonify({"success": True, "opportunity": opportunity.to_dict()}), 200


@opportunities_bp.route("/api/opportunities/<int:opp_id>", methods=["PUT"])
@login_required
def update_opportunity(opp_id):
    """US-2.5: Update one opportunity owned by the logged-in admin."""
    opportunity = Opportunity.query.filter_by(
        id=opp_id, admin_id=current_user.id
    ).first()

    if not opportunity:
        return jsonify({"success": False, "error": "Opportunity not found"}), 404

    data = request.get_json(silent=True) or {}
    payload = _parse_opportunity_payload(data)

    error = _validate_opportunity_payload(payload)
    if error:
        return jsonify({"success": False, "error": error}), 400

    opportunity.name = payload["name"]
    opportunity.duration = payload["duration"]
    opportunity.start_date = payload["start_date"]
    opportunity.description = payload["description"]
    opportunity.skills = payload["skills"]
    opportunity.category = payload["category"]
    opportunity.future_opportunities = payload["future_opportunities"]
    opportunity.max_applicants = _normalize_max_applicants(payload["max_applicants"])
    opportunity.updated_at = datetime.utcnow()

    db.session.commit()

    return jsonify(
        {
            "success": True,
            "message": "Opportunity updated successfully",
            "opportunity": opportunity.to_dict(),
        }
    ), 200


@opportunities_bp.route("/api/opportunities/<int:opp_id>", methods=["DELETE"])
@login_required
def delete_opportunity(opp_id):
    """US-2.6: Delete one opportunity owned by the logged-in admin."""
    opportunity = Opportunity.query.filter_by(
        id=opp_id, admin_id=current_user.id
    ).first()

    if not opportunity:
        return jsonify({"success": False, "error": "Opportunity not found"}), 404

    db.session.delete(opportunity)
    db.session.commit()

    return jsonify({"success": True, "message": "Opportunity deleted successfully"}), 200
