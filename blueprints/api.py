from flask import Blueprint
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session

from bafser import get_json_values_from_req, log_frontend_error, use_db_session, use_user
from data.ticket import Ticket
from data.user import User
from utils import check_api_key


blueprint = Blueprint("api", __name__)


@blueprint.route("/api/user")
@jwt_required()
@use_db_session()
@use_user()
def user(db_sess: Session, user: User):
    return user.get_dict()


@blueprint.post("/api/frontend_error")
def frontend_error():
    log_frontend_error()
    return "ok"


@blueprint.route("/api/event_platform/user_info_by_ticket")
@use_db_session()
def user_info_by_ticket(db_sess: Session):
    apikey, eventId, code = get_json_values_from_req("apikey", "eventId", "code")
    check_api_key(apikey)

    ticket = Ticket.get_by_code(db_sess, code)
    if ticket is None:
        return {"res": "not found"}

    if ticket.eventId != eventId:
        return {"res": "wrong event"}

    if not ticket.authOnPltf:
        ticket.authOnPltf = True
        db_sess.commit()

    return {
        "res": "ok",
        "data": {
            "typeId": ticket.typeId,
            "typeName": ticket.type.name,
            "personName": ticket.personName,
        },
    }
