from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.log import Actions, Log, Tables
from data.operation import Operations
from data.role import Roles
from data.user import User
from utils import (get_datetime_now, get_json_list_from_req, get_json_values_from_req, jsonify_list, permission_required,
                   randstr, response_msg, response_not_found, use_db_session, use_user)


blueprint = Blueprint("staff", __name__)


@blueprint.route("/api/staff")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_staff)
def staff(db_sess: Session, user: User):
    users = User.all_user_staff(db_sess, user)
    return jsonify_list(users), 200


@blueprint.route("/api/staff", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.add_staff)
def add_staff(db_sess: Session, user: User):
    (name, login), errorRes = get_json_values_from_req("name", "login")
    if errorRes:
        return errorRes

    existing_user = User.get_by_login(db_sess, login, includeDeleted=True)
    if existing_user is not None:
        return response_msg(f"User with login '{login}' already exist"), 400

    password = randstr(8)
    staff = User.new(db_sess, user, login, password, name, [Roles.clerk], user.id)

    staff_json = staff.get_dict()
    staff_json["password"] = password

    return jsonify(staff_json), 200


@blueprint.route("/api/staff/<int:staffId>", methods=["DELETE"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.delete_staff)
def delete_staff(staffId, db_sess: Session, user: User):
    staff = User.get(db_sess, staffId)
    if staff is None:
        return response_not_found("user", staffId)

    if staff.bossId != user.id:
        return response_msg(f"User with 'userId={staffId}' is not your staff"), 403

    staff.delete(user)

    return response_msg("ok"), 200


@blueprint.route("/api/staff/<int:staffId>/reset_password", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.change_staff)
def reset_password(staffId, db_sess: Session, user: User):
    staff = User.get(db_sess, staffId)
    if staff is None:
        return response_not_found("user", staffId)

    if staff.bossId != user.id:
        return response_msg(f"User with 'userId={staffId}' is not your staff"), 403

    password = randstr(8)
    staff.set_password(password)
    staff_json = staff.get_dict()
    staff_json["password"] = password

    db_sess.add(Log(
        date=get_datetime_now(),
        actionCode=Actions.updated,
        userId=user.id,
        userName=user.name,
        tableName=Tables.User,
        recordId=staff.id,
        changes=[("password", "***", "***")]
    ))
    db_sess.commit()

    return jsonify(staff_json), 200


@blueprint.route("/api/events/<int:eventId>/staff")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.get_staff_event, "eventId")
def staff_event(eventId, db_sess: Session, user: User):
    users = User.all_event_staff(db_sess, user, eventId)
    return jsonify_list(users), 200


@blueprint.route("/api/events/<int:eventId>/staff", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.change_staff_event, "eventId")
def change_staff_event(eventId, db_sess: Session, user: User):
    new_staff, errorRes = get_json_list_from_req()
    if errorRes:
        return errorRes

    staff = User.all_user_staff(db_sess, user)
    for s in staff:
        has_access = s.has_access(eventId)
        if s.id in new_staff:
            if has_access:
                continue
            s.add_access(eventId, user)
        else:
            if not has_access:
                continue
            s.remove_access(eventId, user)

    db_sess.commit()

    staff = User.all_event_staff(db_sess, user, eventId)
    return jsonify_list(staff), 200
