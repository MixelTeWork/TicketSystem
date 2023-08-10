from flask import Blueprint, g, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.log import Actions, Log, Tables
from data.operation import Operations
from data.ticket import Ticket
from data.ticket_type import TicketType
from utils import get_datetime_now, get_json_values, permission_required, use_db_session, use_user
from data.event import Event
from data.user import User


blueprint = Blueprint("api", __name__)


@blueprint.route("/api/user")
@jwt_required()
@use_db_session()
@use_user()
def user(db_sess: Session, user: User):
    return jsonify(user.get_dict()), 200


@blueprint.route("/api/events")
@jwt_required()
@use_db_session()
def events(db_sess: Session):
    events = db_sess.query(Event).all()
    return jsonify(list(map(lambda x: x.get_dict(), events))), 200


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


@blueprint.route("/api/ticket_types/<int:eventId>")
@jwt_required()
@use_db_session()
@permission_required(Operations.page_events)
def ticket_types(eventId, db_sess: Session):
    ticket_types = db_sess.query(TicketType).filter(TicketType.eventId == eventId).all()
    return jsonify(list(map(lambda x: x.get_dict(), ticket_types))), 200


@blueprint.route("/api/tickets/<int:eventId>")
@jwt_required()
@use_db_session()
@permission_required(Operations.page_events)
def tickets(eventId, db_sess: Session):
    tickets = db_sess.query(Ticket).filter(Ticket.eventId == eventId).all()
    return jsonify(list(map(lambda x: x.get_dict(), tickets))), 200


@blueprint.route("/api/check_ticket", methods=["POST"])
@use_db_session()
def check_ticket(db_sess: Session):
    data, is_json = g.json
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    (code, eventId), values_error = get_json_values(data, "code", "eventId")

    if values_error:
        return jsonify({"msg": values_error}), 400

    ticket: Ticket = db_sess.query(Ticket).filter(Ticket.code == code).first()

    if not ticket:
        return jsonify({"success": False, "errorCode": "notExist", "ticket": None, "event" : None}), 200

    if ticket.eventId != eventId:
        return jsonify({"success": False, "errorCode": "event", "ticket": ticket.get_dict(), "event" : ticket.event.get_dict()}), 200

    if ticket.scanned:
        return jsonify({"success": False, "errorCode": "scanned", "ticket": ticket.get_dict(), "event" : None}), 200

    old_scanned = ticket.scanned
    old_scannedDate = ticket.scannedDate

    ticket.scanned = True
    ticket.scannedDate = get_datetime_now()

    db_sess.add(Log(
            date=get_datetime_now(),
            actionCode=Actions.scanned,
            userId=-1,
            userName="System",
            tableName=Tables.Ticket,
            recordId=ticket.id,
            changes=[
                ["scanned", old_scanned, ticket.scanned],
                ["scannedDate", old_scannedDate.isoformat() if old_scannedDate is not None else None, ticket.scannedDate.isoformat()],
            ]
        ))

    db_sess.commit()

    return jsonify({"success": True, "errorCode": None, "ticket": ticket.get_dict(), "event" : None}), 200
