from bafser import (
    JsonOpt,
    TJson,
    doc_api,
    get_json_values_from_req,
    parse_date_required,
    protected_route,
    response_msg,
    response_not_found,
)
from flask import Blueprint, jsonify

from data._operations import Operations
from data.event import Event, EventData, EventListData, FullEventData
from data.ticket import Ticket
from data.user import User
from utils import access_required_by_eventId

blueprint = Blueprint("events", __name__)


@blueprint.route("/api/events")
@doc_api(res=list[EventListData | EventData], desc="Доступные события")
@protected_route(perms_any=[Operations.page_events, Operations.scan_tickets])
def events():
    user = User.current
    can_manage = user.has_operation(Operations.page_events)
    events = Event.all_for_user(user)
    if not can_manage:
        events = [event for event in events if event.active]
    counts = Ticket.counts_for_events([event.id for event in events], db_sess=user.db_sess) if can_manage else {}
    return jsonify(
        [
            {
                **event.get_dict(),
                **({"ticketCount": counts.get(event.id, 0)} if can_manage else {}),
            }
            for event in events
        ]
    )


@blueprint.route("/api/events_full")
@doc_api(res=list[FullEventData], desc="Полные данные событий")
@protected_route(perms=Operations.page_debug_events)
def events_full():
    return jsonify(Event.all_full_data())


@blueprint.post("/api/events")
@doc_api(req=TJson["name", str, "date", str, "twoDays", JsonOpt[bool]], res=EventData, desc="Создать событие")
@protected_route(perms=Operations.add_event)
def add_event():
    user = User.current
    name, date, two_days = get_json_values_from_req(("name", str), ("date", str), ("twoDays", bool, False))
    date = parse_date_required(date, message="date is not a valid date")

    event = Event.new(user, name, date, two_days)

    return event.get_dict()


@blueprint.route("/api/events/<int:eventId>")
@doc_api(res=EventData, desc="Получить событие")
@protected_route(perms=Operations.page_events)
@access_required_by_eventId
def event(eventId: int):
    event = Event.get(eventId)
    if event is None:
        return response_not_found("event", eventId)

    return event.get_dict()


@blueprint.route("/api/scanner_events/<int:eventId>")
@doc_api(res=EventData, desc="Событие для сканера")
@protected_route(perms=Operations.scan_tickets)
@access_required_by_eventId
def scanner_events(eventId: int):
    event = Event.get(eventId)
    if event is None:
        return response_not_found("event", eventId)

    if not event.active:
        return response_msg("Event is not active", 403, code="event_inactive")

    return event.get_dict()


@blueprint.post("/api/events/<int:eventId>")
@doc_api(req=TJson["name", str, "date", str, "active", JsonOpt[bool], "twoDays", JsonOpt[bool]], res=EventData, desc="Изменить событие")
@protected_route(perms=Operations.change_event)
@access_required_by_eventId
def update_event(eventId: int):
    user = User.current
    name, date, active, two_days = get_json_values_from_req(("name", str), ("date", str), ("active", bool, None), ("twoDays", bool, None))
    date = parse_date_required(date, message="date is not a valid date")

    event = Event.get(eventId, for_update=True)
    if event is None:
        return response_not_found("event", eventId)

    event.update(user, name, date, active, two_days, commit=False)
    user.db_sess.commit()

    return event.get_dict()


@blueprint.delete("/api/events/<int:eventId>")
@doc_api(res=TJson["msg", str], desc="Удалить событие")
@protected_route(perms=Operations.delete_event)
@access_required_by_eventId
def delete_event(eventId: int):
    user = User.current
    event = Event.get(eventId, for_update=True)
    if event is None:
        return response_not_found("event", eventId)

    event.delete(user)

    return response_msg("ok")


@blueprint.post("/api/events/<int:eventId>/add_access")
@doc_api(res=TJson["msg", str], desc="Выдать доступ к событию")
@protected_route(perms=Operations.page_debug_events)
def add_access(eventId: int):
    user = User.current
    event = Event.get(eventId, includeDeleted=True)
    if event is None:
        return response_not_found("event", eventId)

    if user.has_access(eventId):
        return response_msg(f"user id={user.id} already has access to event id={eventId}", 400)

    user.add_access(eventId, user)

    return response_msg("ok")
