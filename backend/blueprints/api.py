from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.orm import Session
import logging
from data.ticket import Ticket
from utils import get_datetime_now, get_json, get_json_values, use_db_session
from data.event import Event
from data.user import User


blueprint = Blueprint("api", __name__)


@blueprint.route("/api/user")
@jwt_required()
@use_db_session()
def user(db_sess: Session):
    user_id = get_jwt_identity()
    user: User = db_sess.query(User).filter(User.id == user_id).first()
    return jsonify(user.get_dict()), 200


@blueprint.route("/api/events")
@jwt_required()
@use_db_session()
def events(db_sess: Session):
    events = db_sess.query(Event).all()
    return jsonify(list(map(lambda x: x.get_dict(), events))), 200


@blueprint.route("/api/check_ticket", methods=["POST"])
@jwt_required()
@use_db_session()
def check_ticket(db_sess: Session):
    data, is_json = get_json(request)
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    (code, eventId), values_error = get_json_values(data, "code", "eventId")

    if values_error:
        return jsonify({"msg": values_error}), 400

    ticket: Ticket = db_sess.query(Ticket).filter(Ticket.code == code).first()

    if not ticket:
        return jsonify({"success": False, "errorCode": "notExist", "ticket": None}), 200

    if ticket.eventId != eventId:
        return jsonify({"success": False, "errorCode": "event", "ticket": ticket.get_dict()}), 200

    if ticket.scanned:
        return jsonify({"success": False, "errorCode": "scanned", "ticket": ticket.get_dict()}), 200

    user_id = get_jwt_identity()

    ticket.scanned = True
    ticket.scannedById = user_id
    ticket.scannedDate = get_datetime_now()

    db_sess.commit()

    return jsonify({"success": True, "errorCode": None, "ticket": ticket.get_dict()}), 200
