from flask import Blueprint, g, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.log import Actions, Log, Tables
from data.operation import Operations
from data.ticket import Ticket
from data.ticket_type import TicketType
from utils import get_datetime_now, get_json_values, permission_required, use_db_session


blueprint = Blueprint("tickets", __name__)


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
        return jsonify({"success": False, "errorCode": "notExist", "ticket": None, "event": None}), 200

    if ticket.eventId != eventId:
        return jsonify({"success": False, "errorCode": "event", "ticket": ticket.get_dict(), "event": ticket.event.get_dict()}), 200

    if ticket.scanned:
        return jsonify({"success": False, "errorCode": "scanned", "ticket": ticket.get_dict(), "event": None}), 200

    old_scanned = ticket.scanned
    old_scannedDate = ticket.scannedDate

    ticket.scanned = True
    ticket.scannedDate = get_datetime_now()

    db_sess.add(Log(
        date=get_datetime_now(),
        actionCode=Actions.scanned,
        userId=-1,
        userName="Anonym",
        tableName=Tables.Ticket,
        recordId=ticket.id,
        changes=[
                ["scanned", old_scanned, ticket.scanned],
                ["scannedDate", old_scannedDate.isoformat() if old_scannedDate is not None else None,
                 ticket.scannedDate.isoformat()],
                ]
    ))

    db_sess.commit()

    return jsonify({"success": True, "errorCode": None, "ticket": ticket.get_dict(), "event": None}), 200
