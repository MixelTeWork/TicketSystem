from bafser import (
    JsonObj,
    JsonOpt,
    TJson,
    doc_api,
    get_json_values_from_req,
    jsonify_list,
    protected_route,
    response_msg,
    response_not_found,
)
from flask import Blueprint, abort, jsonify

from data._operations import Operations
from data.event import Event
from data.ticket import Ticket, TicketData, TicketPageData, TicketPageJson, TicketStatsData
from data.ticket_type import TicketType
from data.user import User
from utils import access_required

blueprint = Blueprint("tickets", __name__)


class TicketDetailsJson(JsonObj):
    typeId: int = JsonObj.field(min_value=1)
    personName: str = JsonObj.field(max_length=256)
    personLink: str = JsonObj.field(max_length=256)
    promocode: str = JsonObj.field(max_length=64)
    price: JsonOpt[object] = JsonObj.field(default=None, desc="Целое число или null")

    def _validate_object(self) -> str | None:
        if self.price is not None and type(self.price) is not int:
            return "price is not int or None"
        if self.price is not None and self.price < 0:
            return "price must be nonnegative"
        return None


class NewTicketJson(TicketDetailsJson):
    eventId: int = JsonObj.field(min_value=1)
    code: JsonOpt[str] = JsonObj.field(default="", max_length=32)


class UpdateTicketJson(TicketDetailsJson):
    pass


@blueprint.route("/api/events/<int:eventId>/tickets")
@doc_api(res=list[TicketData], desc="Билеты события")
@protected_route(perms=Operations.page_events)
@access_required("eventId")
def tickets(eventId):
    tickets = Ticket.all_for_event(eventId)
    return jsonify_list(tickets)


@blueprint.post("/api/events/<int:eventId>/tickets/page")
@doc_api(req=TicketPageJson, res=TicketPageData, desc="Поиск, фильтры и пагинация билетов события")
@protected_route(perms=Operations.page_events)
@access_required("eventId")
def tickets_page(eventId):
    params = TicketPageJson.get_from_req()
    return jsonify(Ticket.page_for_event(eventId, params))


@blueprint.post("/api/tickets")
@doc_api(req=NewTicketJson, res=TicketData, desc="Создать билет")
@protected_route(perms=Operations.add_ticket)
def add_ticket():
    user = User.current
    data = NewTicketJson.get_from_req()

    if not user.has_access(data.eventId):
        abort(403)

    event = Event.get(data.eventId, for_update=True)
    if event is None or event.deleted:
        return response_not_found("event", data.eventId)

    ttype = TicketType.get(data.typeId)
    if ttype is None:
        return response_not_found("ticketType", data.typeId)
    if ttype.eventId != data.eventId:
        return response_msg(f"TicketType with 'typeId={data.typeId}' is for another event", 400)

    ticket, err = Ticket.new(user, ttype, event, data.personName, data.personLink, data.promocode, data.code, data.price)
    if err:
        return response_msg(err, 400)

    return ticket.get_dict()


@blueprint.post("/api/tickets/<int:ticketId>")
@doc_api(req=UpdateTicketJson, res=TicketData, desc="Изменить билет")
@protected_route(perms=Operations.change_ticket)
def update_ticket(ticketId):
    user = User.current
    data = UpdateTicketJson.get_from_req()

    ticket = Ticket.get(ticketId)
    if ticket is None:
        return response_not_found("ticket", ticketId)
    if not user.has_access(ticket.eventId):
        abort(403)

    ttype = TicketType.get(data.typeId, includeDeleted=data.typeId == ticket.typeId)
    if ttype is None:
        return response_not_found("ticketType", data.typeId)
    if ttype.eventId != ticket.eventId:
        return response_msg(f"TicketType with 'typeId={data.typeId}' is for another event", 400)

    ticket.update(user, data.typeId, data.personName, data.personLink, data.promocode, data.price)

    return ticket.get_dict()


@blueprint.delete("/api/tickets/<int:ticketId>")
@doc_api(res=TJson["msg", str], desc="Удалить билет")
@protected_route(perms=Operations.delete_ticket)
def delete_ticket(ticketId):
    user = User.current
    ticket = Ticket.get(ticketId)
    if ticket is None:
        return response_not_found("ticket", ticketId)
    if not user.has_access(ticket.eventId):
        abort(403)

    ticket.delete(user)

    return response_msg("ok")


@blueprint.post("/api/check_ticket")
@doc_api(req=TJson["code", str, "eventId", int], res=dict, desc="Проверить билет")
@protected_route(perms=Operations.scan_tickets)
def check_ticket():
    code, eventId = get_json_values_from_req(("code", str), ("eventId", int))
    user = User.current

    if not user.has_access(eventId):
        return response_msg("No permission", 403)

    event = Event.get(eventId, includeDeleted=True)
    if event is None:
        return response_not_found("event", eventId)
    if event.deleted or not event.active:
        return response_msg("Event is not active", 403)

    ticket = Ticket.get_by_code(code, for_update=True)
    if ticket is None or not user.has_access(ticket.eventId):
        return {"success": False, "errorCode": "notExist", "ticket": None, "event": None}

    if ticket.eventId != eventId:
        return {"success": False, "errorCode": "event", "ticket": ticket.get_dict(), "event": ticket.event.get_dict()}

    if ticket.scanned:
        return {"success": False, "errorCode": "scanned", "ticket": ticket.get_dict(), "event": None}

    ticket.mark_scanned(user)

    return {"success": True, "errorCode": None, "ticket": ticket.get_dict(), "event": None}


@blueprint.route("/api/events/<int:eventId>/tickets_stats")
@doc_api(res=list[TicketStatsData], desc="Статистика билетов")
@protected_route(perms=Operations.page_events)
@access_required("eventId")
def tickets_stats(eventId):
    return jsonify(Ticket.stats_for_event(eventId))
