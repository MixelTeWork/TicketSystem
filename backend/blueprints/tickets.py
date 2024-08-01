from flask import Blueprint, abort, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func
from sqlalchemy.orm import Session
from data.event import Event
from data.operation import Operations
from data.ticket import Ticket
from data.ticket_type import TicketType
from data.user import User
from utils import (get_datetime_now, get_json_values_from_req, jsonify_list, permission_required,
                   response_msg, response_not_found, use_db_session, use_user)


blueprint = Blueprint("tickets", __name__)


@blueprint.route("/api/events/<int:eventId>/tickets")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_events, "eventId")
def tickets(eventId, db_sess: Session, user: User):
    tickets = Ticket.all_for_event(db_sess, eventId)
    return jsonify_list(tickets), 200


@blueprint.route("/api/tickets", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.add_ticket)
def add_ticket(db_sess: Session, user: User):
    typeId, eventId, personName, personLink, promocode, code = get_json_values_from_req(
        "typeId", "eventId", "personName", "personLink", "promocode", ("code", ""))

    if not user.has_access(eventId):
        abort(403)

    event = Event.get(db_sess, eventId)
    if event is None:
        return response_not_found("event", eventId)

    ttype = TicketType.get(db_sess, typeId)
    if ttype is None:
        return response_not_found("ticketType", typeId)
    if ttype.eventId != eventId:
        return response_msg(f"TicketType with 'typeId={typeId}' is for another event"), 400

    ticket, err = Ticket.new(user, ttype, event, personName, personLink, promocode, code)
    if err:
        return response_msg(err), 400

    return jsonify(ticket.get_dict()), 200


@blueprint.route("/api/tickets/<int:ticketId>", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.change_ticket)
def update_ticket(ticketId, db_sess: Session, user: User):
    typeId, personName, personLink, promocode = get_json_values_from_req(
        "typeId", "personName", "personLink", "promocode")

    ticket = Ticket.get(db_sess, ticketId)
    if ticket is None:
        return response_not_found("ticket", ticketId)
    if not user.has_access(ticket.eventId):
        abort(403)

    ttype = TicketType.get(db_sess, typeId)
    if ttype is None:
        return response_not_found("ticketType", typeId)
    if ttype.eventId != ticket.eventId:
        return response_msg(f"TicketType with 'typeId={typeId}' is for another event"), 400

    ticket.update(user, typeId, personName, personLink, promocode)

    return jsonify(ticket.get_dict()), 200


@blueprint.route("/api/tickets/<int:ticketId>", methods=["DELETE"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.delete_ticket)
def delete_ticket(ticketId, db_sess: Session, user: User):
    ticket = Ticket.get(db_sess, ticketId)
    if ticket is None:
        return response_not_found("ticket", ticketId)
    if not user.has_access(ticket.eventId):
        abort(403)

    ticket.delete(user)

    return response_msg("ok"), 200


@blueprint.route("/api/check_ticket", methods=["POST"])
@use_db_session()
def check_ticket(db_sess: Session):
    code, eventId = get_json_values_from_req("code", "eventId")

    ticket = Ticket.get_by_code(db_sess, code)
    if ticket is None:
        return jsonify({"success": False, "errorCode": "notExist", "ticket": None, "event": None}), 200

    if ticket.eventId != eventId:
        return jsonify({"success": False, "errorCode": "event", "ticket": ticket.get_dict(), "event": ticket.event.get_dict()}), 200

    if ticket.scanned:
        return jsonify({"success": False, "errorCode": "scanned", "ticket": ticket.get_dict(), "event": None}), 200

    ticket.scanned = True
    ticket.scannedDate = get_datetime_now()

    db_sess.commit()

    return jsonify({"success": True, "errorCode": None, "ticket": ticket.get_dict(), "event": None}), 200


@blueprint.route("/api/events/<int:eventId>/tickets_stats")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_events, "eventId")
def tickets_stats(eventId, db_sess: Session, user: User):
    tickets = db_sess \
        .query(Ticket.typeId, func.count(Ticket.id), func.count(Ticket.id).filter(Ticket.scanned), func.count(Ticket.id).filter(Ticket.authOnPltf)) \
        .filter(Ticket.deleted == False, Ticket.eventId == eventId) \
        .group_by(Ticket.typeId) \
        .all()

    return jsonify(list(map(lambda x: {
        "typeId": x[0],
        "count": x[1],
        "scanned": x[2],
        "authOnPltf": x[3],
    }, tickets))), 200
