from flask import Blueprint
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session

from bfs import (Log, get_json_values_from_req, jsonify_list, parse_date, permission_required,
                 response_msg, response_not_found, use_db_session, use_user)
from data._operations import Operations
from data.event import Event
from data.img import Image
from data.ticket_type import TicketType
from data.user import User
from utils import access_required


blueprint = Blueprint("events", __name__)


@blueprint.route("/api/events")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_events)
def events(db_sess: Session, user: User):
    events = Event.all_for_user(user)
    return jsonify_list(events)


@blueprint.route("/api/events_full")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_debug_events)
def events_full(db_sess: Session, user: User):
    events = db_sess.query(Event).all()
    return jsonify_list(events, "get_dict_full")


@blueprint.route("/api/events", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.add_event)
def add_event(db_sess: Session, user: User):
    name, date = get_json_values_from_req("name", "date")

    date, is_date = parse_date(date)
    if not is_date:
        return response_msg("date is not datetime", 400)

    event = Event.new(user, name, date)

    return event.get_dict()


@blueprint.route("/api/events/<int:eventId>")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_events)
@access_required("eventId")
def event(eventId, db_sess: Session, user: User):
    event = Event.get(db_sess, eventId)
    if event is None:
        return response_not_found("event", eventId)

    return event.get_dict()


@blueprint.route("/api/scanner_events/<int:eventId>")
@use_db_session()
def scanner_events(eventId, db_sess: Session):
    event = Event.get(db_sess, eventId)
    if event is None:
        return response_not_found("event", eventId)

    if not event.active:
        return response_msg("Event is not active", 403)

    return event.get_dict()


@blueprint.route("/api/events/<int:eventId>", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.change_event)
@access_required("eventId")
def update_event(eventId, db_sess: Session, user: User):
    name, date = get_json_values_from_req("name", "date")

    date, is_date = parse_date(date)
    if not is_date:
        return response_msg("date is not datetime", 400)

    event = Event.get(db_sess, eventId)
    if event is None:
        return response_not_found("event", eventId)

    old_name = event.name
    old_date = event.date
    event.name = name
    event.date = date

    Log.updated(event, user, [
        ("name", old_name, name),
        ("date", old_date.isoformat(), date.isoformat()),
    ])

    return event.get_dict()


@blueprint.route("/api/events/<int:eventId>", methods=["DELETE"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.delete_event)
@access_required("eventId")
def delete_event(eventId, db_sess: Session, user: User):
    event = Event.get(db_sess, eventId)
    if event is None:
        return response_not_found("event", eventId)

    ttypes = TicketType.all_for_event(db_sess, eventId)
    event.delete(user, commit=False)
    for ttype in ttypes:
        img: Image = ttype.image
        if img is not None:
            img.delete(user, commit=False)
    db_sess.commit()

    return response_msg("ok")


@blueprint.route("/api/events/<int:eventId>/add_access", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_debug_events)
def add_access(eventId, db_sess: Session, user: User):
    event = Event.get(db_sess, eventId, includeDeleted=True)
    if event is None:
        return response_not_found("event", eventId)

    if user.has_access(eventId):
        return response_msg(f"user id={user.id} already has access to event id={eventId}", 400)

    user.add_access(eventId, user)

    return response_msg("ok")
