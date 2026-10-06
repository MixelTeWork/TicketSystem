from typing import Literal

from bafser import (
    JsonObj,
    JsonOpt,
    Log,
    TJson,
    doc_api,
    get_datetime_now,
    get_json_values_from_req,
    jsonify_list,
    protected_route,
    response_msg,
    response_not_found,
)
from flask import Blueprint, abort

from data._operations import Operations
from data.event import Event
from data.img import Image
from data.ticket_type import TicketType, TicketTypeData
from data.user import User
from utils import access_required

blueprint = Blueprint("ticket_types", __name__)


class TicketTypeChangeJson(JsonObj):
    name: str = JsonObj.field(max_length=64)
    price: JsonOpt[int | None] = JsonObj.field(default=None, min_value=0)
    id: JsonOpt[int | None] = None
    action: Literal["add", "update", "delete"]

    def _validate_object(self) -> str | None:
        if self.action != "add" and self.id is None:
            return "id is required for update and delete"
        if self.action != "delete" and not self.name:
            return "name must have at least 1 character"
        return None


@blueprint.route("/api/events/<int:eventId>/ticket_types")
@doc_api(res=list[TicketTypeData], desc="Типы билетов события")
@protected_route(perms=Operations.page_events)
@access_required("eventId")
def ticket_types(eventId):
    ttypes = TicketType.all_for_event(eventId)
    return jsonify_list(ttypes)


@blueprint.post("/api/events/<int:eventId>/ticket_types")
@doc_api(req=list[TicketTypeChangeJson], res=list[TicketTypeData], desc="Изменить типы билетов")
@protected_route(perms=Operations.change_ticket_types)
@access_required("eventId")
def change_ticket_types(eventId):
    user = User.current
    data = TicketTypeChangeJson.get_list_from_req()

    event = Event.get(eventId, for_update=True)
    if event is None or event.deleted:
        return response_not_found("event", eventId)

    now = get_datetime_now()
    for i, el in enumerate(data):
        name, price, id, action = el.name, el.price, el.id, el.action

        if action == "add":
            TicketType.add(user, event, name, price, now)

        elif action == "update":
            ttype = TicketType.get(id)
            if ttype is None:
                return response_msg(f"el_{i}: TicketType with 'id={id}' not found", 400)
            if ttype.eventId != eventId:
                return response_msg(f"el_{i}: TicketType with 'id={id}' is for another event", 400)
            ttype.update(user, name, price, commit=False, now=now)

        elif action == "delete":
            ttype = TicketType.get(id)
            if ttype is None:
                return response_msg(f"el_{i}: TicketType with 'id={id}' not found", 400)
            if ttype.eventId != eventId:
                return response_msg(f"el_{i}: TicketType with 'id={id}' is for another event", 400)
            ttype.delete(user, commit=False, now=now)

        else:
            return response_msg(f"el_{i}: Wrong action '{action}'", 400)

    user.db_sess.commit()
    ttypes = TicketType.all_for_event(eventId)
    return jsonify_list(ttypes)


@blueprint.route("/api/ticket_types/<int:typeId>")
@doc_api(res=TicketTypeData, desc="Получить тип билета")
@protected_route(perms=Operations.page_events)
def ticket_type(typeId):
    user = User.current
    ttype = TicketType.get(typeId)
    if ttype is None:
        return response_not_found("ticketType", typeId)

    if not user.has_access(ttype.eventId):
        abort(403)

    return ttype.get_dict()


@blueprint.post("/api/ticket_types/<int:typeId>")
@doc_api(req=TJson["img", dict | None, "pattern", dict], res=TicketTypeData, desc="Изменить оформление типа билета")
@protected_route(perms=Operations.change_ticket_types)
def change_ticket_type(typeId):
    user = User.current
    img_json, pattern = get_json_values_from_req(("img", dict | None, None), ("pattern", dict))

    ttype = TicketType.get(typeId)
    if ttype is None:
        return response_not_found("ticketType", typeId)
    if not user.has_access(ttype.eventId):
        abort(403)

    if img_json is not None:
        img, image_error = Image.new(user, img_json)
        if image_error:
            return response_msg(image_error, 400)
        old_img: Image | None = ttype.image
        if old_img is not None:
            old_img.delete(user, commit=False)
        ttype.imageId = img.id

    ttype.pattern = pattern
    Log.updated(ttype, user)

    return ttype.get_dict()
