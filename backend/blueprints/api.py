from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.ticket import Ticket
from utils import check_api_key, get_json_values_from_req, use_db_session, use_user
from data.user import User


blueprint = Blueprint("api", __name__)


@blueprint.route("/api/user")
@jwt_required()
@use_db_session()
@use_user()
def user(db_sess: Session, user: User):
    return jsonify(user.get_dict()), 200


@blueprint.route("/api/event_platform/user_info_by_ticket")
@use_db_session()
def user_info_by_ticket(db_sess: Session):
    (apikey, eventId, code), errorRes = get_json_values_from_req("apikey", "eventId", "code")
    if errorRes:
        return errorRes
    check_api_key(apikey)

    ticket = Ticket.get_by_code(db_sess, code)
    if ticket is None:
        return jsonify({"res": "not found"}), 200

    if ticket.eventId != eventId:
        return jsonify({"res": "wrong event"}), 200

    if not ticket.authOnPltf:
        ticket.authOnPltf = True
        db_sess.commit()

    return jsonify({
        "res": "ok",
        "data": {
            "typeId": ticket.typeId,
            "typeName": ticket.type.name,
            "personName": ticket.personName,
        },
    }), 200
