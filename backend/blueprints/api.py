from bafser import JsonObj, Log, RequestPolicy, doc_api, log_frontend_error, protected_route, request_policy
from flask import Blueprint

from data.ticket import Ticket
from data.user import User, UserData
from utils import check_api_key

bp = Blueprint("api", __name__)


class PlatformLookupJson(JsonObj):
    apikey: str
    eventId: int
    code: str


@bp.route("/api/user")
@doc_api(res=UserData, desc="Текущий пользователь")
@protected_route()
def user():
    user = User.current
    return user.get_dict()


@bp.post("/api/frontend_error")
@doc_api(desc="Записать ошибку фронтенда")
@request_policy(RequestPolicy(
    max_content_length=32 * 1024,
    log_body=True,
    log_query=False,
    body_fields=("msg", "url", "line", "col", "error", "message", "stack"),
    max_log_length=8 * 1024,
))
def frontend_error():
    log_frontend_error()
    return "ok"


@bp.route("/api/v1/user_info_by_ticket")
@doc_api(req=PlatformLookupJson, res=dict, desc="Информация о владельце билета")
def user_info_by_ticket():
    data = PlatformLookupJson.get_from_req()
    check_api_key(data.apikey)

    ticket = Ticket.get_by_code(data.code)
    if ticket is None:
        return {"res": "not found"}

    if ticket.eventId != data.eventId:
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
