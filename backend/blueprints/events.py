from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from utils import (get_datetime_now, get_json_values_from_req, parse_date, permission_required,
                   response_msg, response_not_found, use_db_session, use_user)
from data.log import Actions, Log, Tables
from data.operation import Operations
from data.permission_access import PermissionAccess
from data.event import Event
from data.user import User


blueprint = Blueprint("events", __name__)


@blueprint.route("/api/events")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_events)
def events(db_sess: Session, user: User):
    events = db_sess \
        .query(Event) \
        .filter(Event.deleted == False, User.access.any((PermissionAccess.eventId == Event.id) & (PermissionAccess.userId == user.id))) \
        .all()
    return jsonify(list(map(lambda x: x.get_dict(), events))), 200


@blueprint.route("/api/event", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.add_event)
def add_event(db_sess: Session, user: User):
    (name, date), errorRes = get_json_values_from_req("name", "date")
    if errorRes:
        return errorRes

    date, is_date = parse_date(date)
    if not is_date:
        return response_msg("date is not datetime"), 400

    event = Event(name=name, date=date)
    db_sess.add(event)

    log = Log(
        date=get_datetime_now(),
        actionCode=Actions.added,
        userId=user.id,
        userName=user.name,
        tableName=Tables.Event,
        recordId=-1,
        changes=event.get_creation_changes()
    )
    db_sess.add(log)
    db_sess.commit()
    log.recordId = event.id
    user.add_access(db_sess, event.id, user)
    db_sess.commit()

    return jsonify(event.get_dict()), 200


@blueprint.route("/api/events/<int:eventId>")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_events, "eventId")
def event(db_sess: Session, user: User, eventId):
    event = db_sess.query(Event).filter(Event.deleted == False, Event.id == eventId).first()
    if event is None:
        return response_not_found("event", eventId)
    return jsonify(event.get_dict()), 200


@blueprint.route("/api/scanner_event/<int:eventId>")
@use_db_session()
def scanner_event(db_sess: Session, eventId):
    event = db_sess.query(Event).filter(Event.deleted == False, Event.id == eventId).first()
    if event is None:
        return response_not_found("event", eventId)
    if not event.active:
        return response_msg("Event is not active"), 403
    return jsonify(event.get_dict()), 200


@blueprint.route("/api/event/<int:eventId>", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.change_event, "eventId")
def update_event(eventId, db_sess: Session, user: User):
    (name, date), errorRes = get_json_values_from_req("name", "date")
    if errorRes:
        return errorRes

    date, is_date = parse_date(date)
    if not is_date:
        return response_msg("date is not datetime"), 400

    event = db_sess.query(Event).filter(Event.deleted == False, Event.id == eventId).first()
    if event is None:
        return response_not_found("event", eventId)

    old_name = event.name
    old_date = event.date
    event.name = name
    event.date = date

    db_sess.add(Log(
        date=get_datetime_now(),
        actionCode=Actions.updated,
        userId=user.id,
        userName=user.name,
        tableName=Tables.Event,
        recordId=eventId,
        changes=[
            ("name", old_name, name),
            ("date", old_date.isoformat(), date.isoformat()),
        ]
    ))
    db_sess.commit()

    return jsonify(event.get_dict()), 200


@blueprint.route("/api/event/<int:eventId>", methods=["DELETE"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.delete_event, "eventId")
def delete_event(eventId, db_sess: Session, user: User):
    event = db_sess.query(Event).filter(Event.deleted == False, Event.id == eventId).first()
    if event is None:
        return response_not_found("event", eventId)

    event.deleted = True

    db_sess.add(Log(
        date=get_datetime_now(),
        actionCode=Actions.deleted,
        userId=user.id,
        userName=user.name,
        tableName=Tables.Event,
        recordId=eventId,
        changes=[]
    ))
    db_sess.commit()

    return response_msg("ok"), 200
