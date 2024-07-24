from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from utils import (get_datetime_now, get_json_values_from_req, jsonify_list, parse_date, permission_required,
                   response_msg, response_not_found, use_db_session, use_user)
from data.log import Actions, Log, Tables
from data.operation import Operations
from data.event import Event
from data.user import User


blueprint = Blueprint("events", __name__)


@blueprint.route("/api/events")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_events)
def events(db_sess: Session, user: User):
    events = Event.all_for_user(db_sess, user)
    return jsonify_list(events), 200


@blueprint.route("/api/events", methods=["POST"])
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

    event = Event.new(db_sess, user, name, date)

    return jsonify(event.get_dict()), 200


@blueprint.route("/api/events/<int:eventId>")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_events, "eventId")
def event(db_sess: Session, user: User, eventId):
    event = Event.get(db_sess, eventId)
    if event is None:
        return response_not_found("event", eventId)

    return jsonify(event.get_dict()), 200


@blueprint.route("/api/scanner_events/<int:eventId>")
@use_db_session()
def scanner_events(db_sess: Session, eventId):
    event = Event.get(db_sess, eventId)
    if event is None:
        return response_not_found("event", eventId)

    if not event.active:
        return response_msg("Event is not active"), 403

    return jsonify(event.get_dict()), 200


@blueprint.route("/api/events/<int:eventId>", methods=["POST"])
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

    event = Event.get(db_sess, eventId)
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


@blueprint.route("/api/events/<int:eventId>", methods=["DELETE"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.delete_event, "eventId")
def delete_event(eventId, db_sess: Session, user: User):
    event = Event.get(db_sess, eventId)
    if event is None:
        return response_not_found("event", eventId)

    event.delete(user)

    return response_msg("ok"), 200
