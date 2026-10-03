from bafser import Log, get_json_values_from_req, log_frontend_error, protected_route, use_db_session
from flask import Blueprint
from sqlalchemy.orm import Session

from data.ticket import Ticket
from data.user import User
from utils import check_api_key

blueprint = Blueprint("api", __name__)


@blueprint.route("/api/user")
@use_db_session
@protected_route()
def user(db_sess: Session):
    user = User.current
    return user.get_dict()


@blueprint.post("/api/frontend_error")
def frontend_error():
    log_frontend_error()
    return "ok"


@blueprint.route("/api/v1/user_info_by_ticket")
@use_db_session
def user_info_by_ticket(db_sess: Session):
    apikey, eventId, code = get_json_values_from_req(("apikey", str), ("eventId", int), ("code", str))
    check_api_key(apikey)

    ticket = Ticket.get_by_code(db_sess, code)
    if ticket is None:
        return {"res": "not found"}

    if ticket.eventId != eventId:
        return {"res": "wrong event"}

    if not ticket.authOnPltf:
        ticket.authOnPltf = True
        Log.updated(ticket)

    return {
        "res": "ok",
        "data": {
            "typeId": ticket.typeId,
            "typeName": ticket.type.name,
            "personName": ticket.personName,
        },
    }
