from flask import Blueprint, abort, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.event import Event
from data.image import Image
from data.log import Actions, Log, Tables
from data.operation import Operations
from data.ticket_type import TicketType
from data.user import User
from utils import (get_datetime_now, get_json_list_from_req, get_json_values, get_json_values_from_req, jsonify_list, permission_required,
                   response_msg, response_not_found, use_db_session, use_user)


blueprint = Blueprint("ticket_types", __name__)


@blueprint.route("/api/ticket_types/<int:eventId>")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_events, "eventId")
def ticket_types(eventId, db_sess: Session, user: User):
    ttypes = TicketType.all_for_event(db_sess, eventId)
    return jsonify_list(ttypes), 200


@blueprint.route("/api/ticket_types/<int:eventId>", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.change_ticket_types, "eventId")
def change_ticket_types(eventId, db_sess: Session, user: User):
    data, errorRes = get_json_list_from_req()
    if errorRes:
        return errorRes

    event = Event.get(db_sess, eventId)
    if event is None:
        return response_not_found("event", eventId)

    now = get_datetime_now()
    logs = []
    for i, el in enumerate(data):
        # pylint: disable=redefined-builtin
        (name, id, action), values_error = get_json_values(el, "name", ("id", None), "action")
        if values_error:
            return response_msg(f"el_{i}" + values_error), 400

        if action == "add":
            log = TicketType.add(user, event, name, now)
            logs.append(log)

        elif action == "update":
            ttype = TicketType.get(db_sess, id)
            if ttype is None:
                return response_msg(f"el_{i}: TicketType with 'id={id}' not found"), 400
            ttype.update_name(user, name, now)

        elif action == "delete":
            ttype = TicketType.get(db_sess, id)
            if ttype is None:
                return response_msg(f"el_{i}: TicketType with 'id={id}' not found"), 400
            ttype.delete(user, now)

        else:
            return response_msg(f"el_{i}: Wrong action '{action}'"), 400

    db_sess.commit()
    if len(logs) > 0:
        for (log, ttype) in logs:
            log.recordId = ttype.id
        db_sess.commit()

    ttypes = TicketType.all_for_event(db_sess, eventId)
    return jsonify_list(ttypes), 200


@blueprint.route("/api/ticket_type/<int:typeId>")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_events)
def ticket_type(typeId, db_sess: Session, user: User):
    ttype = TicketType.get(db_sess, typeId)
    if ttype is None:
        return response_not_found("ticketType", typeId)

    if not user.has_access(ttype.eventId):
        abort(403)

    return jsonify(ttype.get_dict()), 200


@blueprint.route("/api/ticket_type/<int:typeId>", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.change_ticket_types)
def change_ticket_type(typeId, db_sess: Session, user: User):
    (img_json, pattern), errorRes = get_json_values_from_req(("img", None), "pattern")
    if errorRes:
        return errorRes

    ttype = TicketType.get(db_sess, typeId)
    if ttype is None:
        return response_not_found("ticketType", typeId)
    if not user.has_access(ttype.eventId):
        abort(403)

    pattern_old = ttype.pattern
    changes = [("pattern", pattern_old, pattern)]
    ttype.pattern = pattern

    if img_json is not None:
        img, image_error = Image.new(db_sess, user, img_json)
        if image_error:
            return response_msg(image_error), 400
        old_img = ttype.image
        if old_img is not None:
            old_img.delete(user)
            changes.append(("imageId", old_img.id, img.id))
        else:
            changes.append(("imageId", None, img.id))
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
