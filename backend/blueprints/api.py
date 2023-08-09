from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
import logging
from data.log import Actions, Log, Tables
from data.operation import Operations
from data.ticket import Ticket
from data.ticket_type import TicketType
from utils import get_datetime_now, get_json, get_json_values, permission_required, use_db_session, use_user
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
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_scanner)
def check_ticket(db_sess: Session, user: User):
    data, is_json = get_json(request)
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    (code, eventId), values_error = get_json_values(data, "code", "eventId")

    if values_error:
        return jsonify({"msg": values_error}), 400

    ticket: Ticket = db_sess.query(Ticket).filter(Ticket.code == code).first()

    if not ticket:
        return jsonify({"success": False, "errorCode": "notExist", "ticket": None}), 200

    if ticket.eventId != eventId:
        return jsonify({"success": False, "errorCode": "event", "ticket": ticket.get_dict()}), 200

    if ticket.scanned:
        return jsonify({"success": False, "errorCode": "scanned", "ticket": ticket.get_dict()}), 200

    old_scanned = ticket.scanned
    old_scannedById = ticket.scannedById
    old_scannedDate = ticket.scannedDate

    ticket.scanned = True
    ticket.scannedById = user.id
    ticket.scannedDate = get_datetime_now()

    logging.info(f"Ticket checked {ticket}")
    db_sess.add(Log(
            date=get_datetime_now(),
            actionCode=Actions.scanned,
            userId=user.id,
            userName=user.name,
            tableName=Tables.Ticket,
            recordId=ticket.id,
            changes=[
                ["scanned", old_scanned, ticket.scanned],
                ["scannedById", old_scannedById, ticket.scannedById],
                ["scannedDate", old_scannedDate.isoformat() if old_scannedDate is not None else None, ticket.scannedDate.isoformat()],
            ]
        ))

    db_sess.commit()

    return jsonify({"success": True, "errorCode": None, "ticket": ticket.get_dict()}), 200
