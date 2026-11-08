from bafser import JsonObj, Log, doc_api, log_frontend_error, protected_route
from flask import Blueprint

from data.ticket import Ticket
from data.user import User, UserData
from utils import check_api_key

blueprint = Blueprint("api", __name__)


class PlatformLookupJson(JsonObj):
    apikey: str
    eventId: int
    code: str


@blueprint.route("/api/user")
@doc_api(res=UserData, desc="Текущий пользователь")
@protected_route()
def user():
    user = User.current
    return user.get_dict()


@blueprint.post("/api/frontend_error")
@doc_api(desc="Записать ошибку фронтенда")
def frontend_error():
    log_frontend_error()
    return "ok"


@blueprint.route("/api/v1/user_info_by_ticket")
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
