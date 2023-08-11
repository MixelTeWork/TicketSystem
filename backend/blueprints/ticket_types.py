from flask import Blueprint, g, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.event import Event
from data.log import Actions, Log, Tables
from data.operation import Operations
from data.ticket_type import TicketType
from data.user import User
from utils import get_datetime_now, get_json_values, permission_required, use_db_session, use_user


blueprint = Blueprint("ticket_types", __name__)


@blueprint.route("/api/ticket_types/<int:eventId>")
@jwt_required()
@use_db_session()
@permission_required(Operations.page_events)
def ticket_types(eventId, db_sess: Session):
    ticket_types = db_sess.query(TicketType).filter(TicketType.eventId == eventId).all()
    return jsonify(list(map(lambda x: x.get_dict(), ticket_types))), 200


@blueprint.route("/api/ticket_types/<int:eventId>", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.change_ticket_types)
def change_ticket_types(eventId, db_sess: Session, user: User):
    data, is_json = g.json
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    if not isinstance(data, list):
        return jsonify({"msg": "body is not json list"}), 400

    event = db_sess.query(Event).filter(Event.id == eventId).first()

    if event is None:
        return jsonify({"msg": f"Event with 'eventId={eventId}' not found"}), 400

    now = get_datetime_now()
    logs = []
    for i in range(len(data)):
        el = data[i]
        (name, id, action), values_error = get_json_values(el, "name", ("id", None), "action")
        if values_error:
            return jsonify({"msg": f"el_{i}" + values_error}), 400

        if action == "add":
            ttype = TicketType(eventId=eventId, name=name)
            db_sess.add(ttype)
            log = Log(
                date=now,
                actionCode=Actions.added,
                userId=user.id,
                userName=user.name,
                tableName=Tables.TicketType,
                recordId=-1,
                changes=ttype.get_creation_changes()
            )
            db_sess.add(log)
            logs.append((log, ttype))

        elif action == "update":
            ttype = db_sess.query(TicketType).filter(TicketType.id == id).first()
            if ttype is None:
                return jsonify({"msg": f"el_{i}: TicketType with 'id={id}' not found"}), 400

            old_name = ttype.name
            ttype.name = name
            log = Log(
                date=now,
                actionCode=Actions.updated,
                userId=user.id,
                userName=user.name,
                tableName=Tables.TicketType,
                recordId=ttype.id,
                changes=[("name", old_name, name)]
            )
            db_sess.add(log)

        elif action == "delete":
            ttype = db_sess.query(TicketType).filter(TicketType.id == id).first()
            if ttype is None:
                return jsonify({"msg": f"el_{i}: TicketType with 'id={id}' not found"}), 400

            ttype.deleted = True
            log = Log(
                date=now,
                actionCode=Actions.deleted,
                userId=user.id,
                userName=user.name,
                tableName=Tables.TicketType,
                recordId=ttype.id,
                changes=[]
            )
            db_sess.add(log)

        else:
            return jsonify({"msg": f"el_{i}: Wrong action '{action}'"}), 400

    db_sess.commit()
    if len(logs) > 0:
        for (log, ttype) in logs:
            log.recordId = ttype.id
        db_sess.commit()

    ticket_types = db_sess.query(TicketType).filter(TicketType.eventId == eventId).all()
    return jsonify(list(map(lambda x: x.get_dict(), ticket_types))), 200
