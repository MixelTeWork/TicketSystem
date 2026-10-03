from bafser import (
    Log,
    get_json_values_from_req,
    jsonify_list,
    parse_date,
    protected_route,
    response_msg,
    response_not_found,
    use_db_session,
)
from flask import Blueprint
from sqlalchemy.orm import Session

from data._operations import Operations
from data.event import Event
from data.user import User
from utils import access_required

blueprint = Blueprint("events", __name__)


@blueprint.route("/api/events")
@use_db_session
@protected_route(perms=Operations.page_events)
def events(db_sess: Session):
    user = User.current
    events = Event.all_for_user(user)
    return jsonify_list(events)


@blueprint.route("/api/events_full")
@use_db_session
@protected_route(perms=Operations.page_debug_events)
def events_full(db_sess: Session):
    events = db_sess.query(Event).all()
    return jsonify_list(events, "get_dict_full")


@blueprint.post("/api/events")
@use_db_session
@protected_route(perms=Operations.add_event)
def add_event(db_sess: Session):
    user = User.current
    name, date = get_json_values_from_req(("name", str), ("date", object))

    date, is_date = parse_date(date)
    if not is_date:
        return response_msg("date is not datetime", 400)

    event = Event.new(user, name, date)

    return event.get_dict()


@blueprint.route("/api/events/<int:eventId>")
@use_db_session
@protected_route(perms=Operations.page_events)
@access_required("eventId")
def event(eventId, db_sess: Session):
    event = Event.get(db_sess, eventId)
    if event is None:
        return response_not_found("event", eventId)

    return event.get_dict()


@blueprint.route("/api/scanner_events/<int:eventId>")
@use_db_session
def scanner_events(eventId, db_sess: Session):
    event = Event.get(db_sess, eventId)
    if event is None:
        return response_not_found("event", eventId)

    if not event.active:
        return response_msg("Event is not active", 403)

    return event.get_dict()


@blueprint.post("/api/events/<int:eventId>")
@use_db_session
@protected_route(perms=Operations.change_event)
@access_required("eventId")
def update_event(eventId, db_sess: Session):
    user = User.current
    name, date = get_json_values_from_req(("name", str), ("date", object))

    date, is_date = parse_date(date)
    if not is_date:
        return response_msg("date is not datetime", 400)

    event = Event.get(db_sess, eventId)
    if event is None:
        return response_not_found("event", eventId)

    event.name = name
    event.date = date

    Log.updated(event, user)

    return event.get_dict()


@blueprint.delete("/api/events/<int:eventId>")
@use_db_session
@protected_route(perms=Operations.delete_event)
@access_required("eventId")
def delete_event(eventId, db_sess: Session):
    user = User.current
    event = Event.get(db_sess, eventId)
    if event is None:
        return response_not_found("event", eventId)

    event.delete(user)

    return response_msg("ok")


@blueprint.post("/api/events/<int:eventId>/add_access")
@use_db_session
@protected_route(perms=Operations.page_debug_events)
def add_access(eventId, db_sess: Session):
    user = User.current
    event = Event.get(db_sess, eventId, includeDeleted=True)
    if event is None:
        return response_not_found("event", eventId)

    if user.has_access(eventId):
        return response_msg(f"user id={user.id} already has access to event id={eventId}", 400)

    user.add_access(eventId, user)

    return response_msg("ok")
