from flask import Blueprint, abort
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from typing import Union

from bafser import (Log, get_datetime_now, get_json_list_from_req, get_json_values, get_json_values_from_req,
                 jsonify_list, permission_required, response_msg, response_not_found, use_db_session, use_user)
from data._operations import Operations
from data.event import Event
from data.img import Image
from data.ticket_type import TicketType
from data.user import User
from utils import access_required


blueprint = Blueprint("ticket_types", __name__)


@blueprint.route("/api/events/<int:eventId>/ticket_types")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_events)
@access_required("eventId")
def ticket_types(eventId, db_sess: Session, user: User):
    ttypes = TicketType.all_for_event(db_sess, eventId)
    return jsonify_list(ttypes)


@blueprint.post("/api/events/<int:eventId>/ticket_types")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.change_ticket_types)
@access_required("eventId")
def change_ticket_types(eventId, db_sess: Session, user: User):
    data = get_json_list_from_req()

    event = Event.get(db_sess, eventId)
    if event is None:
        return response_not_found("event", eventId)

    now = get_datetime_now()
    logs: list[tuple[TicketType, Log]] = []
    for i, el in enumerate(data):
        (name, id, action), values_error = get_json_values(el, "name", ("id", None), "action")
        if values_error:
            return response_msg(f"el_{i}: " + values_error, 400)

        if action == "add":
            data_for_log = TicketType.add(user, event, name, now)
            logs.append(data_for_log)

        elif action == "update":
            ttype = TicketType.get(db_sess, id)
            if ttype is None:
                return response_msg(f"el_{i}: TicketType with 'id={id}' not found", 400)
            ttype.update_name(user, name, commit=False, now=now)

        elif action == "delete":
            ttype = TicketType.get(db_sess, id)
            if ttype is None:
                return response_msg(f"el_{i}: TicketType with 'id={id}' not found", 400)
            ttype.delete(user, commit=False, now=now)

        else:
            return response_msg(f"el_{i}: Wrong action '{action}'", 400)

    db_sess.commit()
    if len(logs) > 0:
        for (ttype, log) in logs:
            log.recordId = ttype.id
        db_sess.commit()

    ttypes = TicketType.all_for_event(db_sess, eventId)
    return jsonify_list(ttypes)


@blueprint.route("/api/ticket_types/<int:typeId>")
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

    return ttype.get_dict()


@blueprint.post("/api/ticket_types/<int:typeId>")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.change_ticket_types)
def change_ticket_type(typeId, db_sess: Session, user: User):
    img_json, pattern = get_json_values_from_req(("img", None), "pattern")

    ttype = TicketType.get(db_sess, typeId)
    if ttype is None:
        return response_not_found("ticketType", typeId)
    if not user.has_access(ttype.eventId):
        abort(403)

    pattern_old = ttype.pattern
    changes = [("pattern", pattern_old, pattern)]
    ttype.pattern = pattern

    if img_json is not None:
        img, image_error = Image.new(user, img_json)
        if image_error:
            return response_msg(image_error, 400)
        old_img: Union[Image, None] = ttype.image
        if old_img is not None:
            old_img.delete(user, commit=False)
            changes.append(("imageId", old_img.id, img.id))
        else:
            changes.append(("imageId", None, img.id))
        ttype.image = img

    Log.updated(ttype, user, changes)

    return ttype.get_dict()
