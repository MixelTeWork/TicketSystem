from flask import Blueprint, g, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.log import Actions, Log, Tables
from data.operation import Operations
from utils import get_datetime_now, get_json_values, parse_date, permission_required, use_db_session, use_user
from data.event import Event
from data.user import User


blueprint = Blueprint("events", __name__)


@blueprint.route("/api/events")
@jwt_required()
@use_db_session()
def events(db_sess: Session):
    events = db_sess.query(Event).all()
    return jsonify(list(map(lambda x: x.get_dict(), events))), 200


@blueprint.route("/api/event", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.add_event)
def add_event(db_sess: Session, user: User):
    data, is_json = g.json
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    (name, date), values_error = get_json_values(data, "name", "date")

    if values_error:
        return jsonify({"msg": values_error}), 400

    date, is_date = parse_date(date)

    if not is_date:
        return jsonify({"msg": "date is not datetime"}), 400

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
    db_sess.commit()

    return jsonify(event.get_dict()), 200


@blueprint.route("/api/events/<int:eventId>")
@jwt_required()
@use_db_session()
def event(db_sess: Session, eventId):
    event = db_sess.query(Event).filter(Event.id == eventId).first()
    return jsonify(event.get_dict()), 200


@blueprint.route("/api/scanner_event/<int:eventId>")
@use_db_session()
def scanner_event(db_sess: Session, eventId):
    event = db_sess.query(Event).filter(Event.id == eventId).first()
    if not event.active:
        return jsonify({"msg": "Event is not active"}), 403
    return jsonify(event.get_dict()), 200
