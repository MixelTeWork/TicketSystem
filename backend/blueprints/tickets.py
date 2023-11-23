from flask import Blueprint, abort, g, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy import func
from sqlalchemy.orm import Session
from data.event import Event
from data.log import Actions, Log, Tables
from data.operation import Operations
from data.ticket import Ticket
from data.ticket_type import TicketType
from data.user import User
from utils import get_datetime_now, get_json_values, permission_required, use_db_session, use_user


blueprint = Blueprint("tickets", __name__)


@blueprint.route("/api/tickets/<int:eventId>")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_events, "eventId")
def tickets(eventId, db_sess: Session, user: User):
    tickets = db_sess.query(Ticket).filter(Ticket.deleted == False, Ticket.eventId == eventId).all()
    return jsonify(list(map(lambda x: x.get_dict(), tickets))), 200


@blueprint.route("/api/ticket", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.add_ticket)
def add_ticket(db_sess: Session, user: User):
    data, is_json = g.json
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    (typeId, eventId, personName, personLink, promocode, code), values_error = get_json_values(
        data, "typeId", "eventId", "personName", "personLink", "promocode", ("code", ""))

    if values_error:
        return jsonify({"msg": values_error}), 400

    if not user.has_access(eventId):
        abort(403)

    event = db_sess.query(Event).filter(Event.deleted == False, Event.id == eventId).first()

    if event is None:
        return jsonify({"msg": f"Event with 'eventId={eventId}' not found"}), 400

    ttype = db_sess.query(TicketType).filter(TicketType.deleted == False, TicketType.id == typeId).first()

    if ttype is None:
        return jsonify({"msg": f"TicketType with 'typeId={typeId}' not found"}), 400

    if ttype.eventId != eventId:
        return jsonify({"msg": f"TicketType with 'typeId={typeId}' is for another event"}), 400

    now = get_datetime_now()
    ticket = Ticket(createdDate=now, createdById=user.id, eventId=eventId, typeId=typeId,
                    personName=personName, personLink=personLink, promocode=promocode)

    if code:
        ticket_with_code = db_sess.query(Ticket).filter(Ticket.code == code).first()
        if ticket_with_code is not None:
            return jsonify({"msg": f"Ticket with 'code={code}' is already exist"}), 400
        ticket.code = code
    else:
        ticket.set_code(event.date, event.lastTicketNumber, ttype.number)
        event.lastTicketNumber += 1
    db_sess.add(ticket)

    log = Log(
        date=now,
        actionCode=Actions.added,
        userId=user.id,
        userName=user.name,
        tableName=Tables.Ticket,
        recordId=-1,
        changes=ticket.get_creation_changes()
    )
    db_sess.add(log)
    db_sess.commit()
    log.recordId = ticket.id
    db_sess.commit()

    return jsonify(ticket.get_dict()), 200


@blueprint.route("/api/ticket/<int:ticketId>", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.change_ticket)
def update_ticket(ticketId, db_sess: Session, user: User):
    data, is_json = g.json
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    (typeId, personName, personLink, promocode, code), values_error = get_json_values(
        data, "typeId", "personName", "personLink", "promocode", "code")

    if values_error:
        return jsonify({"msg": values_error}), 400

    ticket: Ticket = db_sess.query(Ticket).filter(Ticket.deleted == False, Ticket.id == ticketId).first()
    if not ticket:
        return jsonify({"msg": f"Ticket with 'ticketId={ticketId}' not found"}), 400

    if not user.has_access(ticket.eventId):
        abort(403)

    ttype = db_sess.query(TicketType).filter(TicketType.deleted == False, TicketType.id == typeId).first()

    if ttype is None:
        return jsonify({"msg": f"TicketType with 'typeId={typeId}' not found"}), 400

    if ttype.eventId != ticket.eventId:
        return jsonify({"msg": f"TicketType with 'typeId={typeId}' is for another event"}), 400

    if code != ticket.code:
        ticket_with_code = db_sess.query(Ticket).filter(Ticket.code == code).first()
        if ticket_with_code is not None:
            return jsonify({"msg": f"Ticket with 'code={code}' is already exist"}), 400

    now = get_datetime_now()
    db_sess.add(Log(
        date=now,
        actionCode=Actions.updated,
        userId=user.id,
        userName=user.name,
        tableName=Tables.Ticket,
        recordId=ticket.id,
        changes=list(filter(lambda v: v[1] != v[2], [
            ("updatedDate", ticket.updatedDate.isoformat() if ticket.updatedDate is not None else None, now.isoformat()),
            ("updatedById", ticket.updatedById, user.id),
            ("typeId", ticket.typeId, typeId),
            ("code", ticket.code, code),
            ("personName", ticket.personName, personName),
            ("personLink", ticket.personLink, personLink),
            ("promocode", ticket.promocode, promocode),
        ]))
    ))
    ticket.updatedDate = now
    ticket.updatedById = user.id
    ticket.typeId = typeId
    ticket.code = code
    ticket.personName = personName
    ticket.personLink = personLink
    ticket.promocode = promocode

    db_sess.commit()

    return jsonify(ticket.get_dict()), 200


@blueprint.route("/api/ticket/<int:ticketId>", methods=["DELETE"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.delete_ticket)
def delete_ticket(ticketId, db_sess: Session, user: User):
    ticket: Ticket = db_sess.query(Ticket).filter(Ticket.deleted == False, Ticket.id == ticketId).first()
    if not ticket:
        return jsonify({"msg": f"Ticket with 'ticketId={ticketId}' not found"}), 400

    if not user.has_access(ticket.eventId):
        abort(403)

    ticket.deleted = True

    db_sess.add(Log(
        date=get_datetime_now(),
        actionCode=Actions.deleted,
        userId=user.id,
        userName=user.name,
        tableName=Tables.Ticket,
        recordId=ticketId,
        changes=[]
    ))
    db_sess.commit()

    return "", 200


@blueprint.route("/api/check_ticket", methods=["POST"])
@use_db_session()
def check_ticket(db_sess: Session):
    data, is_json = g.json
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    (code, eventId), values_error = get_json_values(data, "code", "eventId")

    if values_error:
        return jsonify({"msg": values_error}), 400

    ticket: Ticket = db_sess.query(Ticket).filter(Ticket.deleted == False, Ticket.code == code).first()

    if not ticket:
        return jsonify({"success": False, "errorCode": "notExist", "ticket": None, "event": None}), 200

    if ticket.eventId != eventId:
        return jsonify({"success": False, "errorCode": "event", "ticket": ticket.get_dict(), "event": ticket.event.get_dict()}), 200

    if ticket.scanned:
        return jsonify({"success": False, "errorCode": "scanned", "ticket": ticket.get_dict(), "event": None}), 200

    ticket.scanned = True
    ticket.scannedDate = get_datetime_now()

    db_sess.commit()

    return jsonify({"success": True, "errorCode": None, "ticket": ticket.get_dict(), "event": None}), 200


@blueprint.route("/api/tickets_stats/<int:eventId>")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_events, "eventId")
def tickets_stats(eventId, db_sess: Session, user: User):
    tickets = db_sess \
        .query(Ticket.typeId, func.count(Ticket.id)) \
        .filter(Ticket.deleted == False, Ticket.eventId == eventId) \
        .group_by(Ticket.typeId) \
        .all()

    return jsonify(list(map(lambda x: {
        "typeId": x[0],
        "count": x[1],
    }, tickets))), 200
