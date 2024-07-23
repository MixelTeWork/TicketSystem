from flask import Blueprint, abort, g, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.event import Event
from data.image import Image
from data.log import Actions, Log, Tables
from data.operation import Operations
from data.ticket_type import TicketType
from data.user import User
from utils import get_datetime_now, get_json_values, permission_required, use_db_session, use_user


blueprint = Blueprint("ticket_types", __name__)


@blueprint.route("/api/ticket_types/<int:eventId>")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_events, "eventId")
def ticket_types(eventId, db_sess: Session, user: User):
    ticket_types = db_sess.query(TicketType).filter(TicketType.deleted == False, TicketType.eventId == eventId).all()
    return jsonify(list(map(lambda x: x.get_dict(), ticket_types))), 200


@blueprint.route("/api/ticket_types/<int:eventId>", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.change_ticket_types, "eventId")
def change_ticket_types(eventId, db_sess: Session, user: User):
    data, is_json = g.json
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    if not isinstance(data, list):
        return jsonify({"msg": "body is not json list"}), 400

    event = db_sess.query(Event).filter(Event.deleted == False, Event.id == eventId).first()

    if event is None:
        return jsonify({"msg": f"Event with 'eventId={eventId}' not found"}), 400

    now = get_datetime_now()
    logs = []
    for i, el in enumerate(data):
        # pylint: disable=redefined-builtin
        (name, id, action), values_error = get_json_values(el, "name", ("id", None), "action")
        if values_error:
            return jsonify({"msg": f"el_{i}" + values_error}), 400

        if action == "add":
            ttype = TicketType(eventId=eventId, name=name, number=event.lastTypeNumber)
            event.lastTypeNumber += 1
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
            ttype = db_sess.query(TicketType).filter(TicketType.deleted == False, TicketType.id == id).first()
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
            ttype = db_sess.query(TicketType).filter(TicketType.deleted == False, TicketType.id == id).first()
            if ttype is None:
                return jsonify({"msg": f"el_{i}: TicketType with 'id={id}' not found"}), 400

            ttype.deleted = True
            ttype.image.delete(db_sess, user)
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

    ticket_types = db_sess.query(TicketType).filter(TicketType.deleted == False, TicketType.eventId == eventId).all()
    return jsonify(list(map(lambda x: x.get_dict(), ticket_types))), 200


@blueprint.route("/api/ticket_type/<int:typeId>")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_events)
def ticket_type(typeId, db_sess: Session, user: User):
    ttype: TicketType = db_sess.query(TicketType).get(typeId)
    if not ttype or ttype.deleted:
        return jsonify({"msg": f"TicketType with 'id={typeId}' not found"}), 400
    if not user.has_access(ttype.eventId):
        abort(403)
    return jsonify(ttype.get_dict()), 200


@blueprint.route("/api/ticket_type/<int:typeId>", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.change_ticket_types)
def change_ticket_type(typeId, db_sess: Session, user: User):
    data, is_json = g.json
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    (img_json, pattern), values_error = get_json_values(data, ("img", None), "pattern")
    if values_error:
        return jsonify({"msg": values_error}), 400

    ttype: TicketType = db_sess.query(TicketType).get(typeId)
    if not ttype or ttype.deleted:
        return jsonify({"msg": f"TicketType with 'id={typeId}' not found"}), 400
    if not user.has_access(ttype.eventId):
        abort(403)

    pattern_old = ttype.pattern
    changes = [("pattern", pattern_old, pattern)]
    ttype.pattern = pattern

    if img_json is not None:
        img, image_error = Image.new(db_sess, user, img_json)
        if image_error:
            return jsonify({"msg": image_error}), 400
        old_img: Image = ttype.image
        if old_img is not None:
            old_img.delete(db_sess, user)
            changes.append(("imageId", old_img.id, img.id))
        ttype.image = img

    log = Log(
        date=get_datetime_now(),
        actionCode=Actions.updated,
        userId=user.id,
        userName=user.name,
        tableName=Tables.TicketType,
        recordId=ttype.id,
        changes=changes
    )
    db_sess.add(log)
    db_sess.commit()

    return jsonify(ttype.get_dict()), 200
