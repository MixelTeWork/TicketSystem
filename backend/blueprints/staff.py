from flask import Blueprint
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session

from bfs import (Log, get_json_list_from_req, get_json_values_from_req, jsonify_list, permission_required,
                 randstr, response_msg, response_not_found, use_db_session, use_user)
from data._operations import Operations
from data._roles import Roles
from data._tables import Tables
from data.user import User
from utils import access_required


blueprint = Blueprint("staff", __name__)


@blueprint.route("/api/staff")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_staff)
def staff(db_sess: Session, user: User):
    users = User.all_user_staff(user)
    return jsonify_list(users)


@blueprint.route("/api/staff", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.add_staff)
def add_staff(db_sess: Session, user: User):
    name, login = get_json_values_from_req("name", "login")

    existing_user = User.get_by_login(db_sess, login, includeDeleted=True)
    if existing_user is not None:
        return response_msg(f"User with login '{login}' already exist", 400)

    password = randstr(8)
    staff = User.new(user, login, password, name, [Roles.clerk], user.id)

    staff_json = staff.get_dict()
    staff_json["password"] = password

    return staff_json


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
        return response_msg(f"User with 'userId={staffId}' is not your staff", 403)

    staff.delete(user)

    return response_msg("ok")


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
        return response_msg(f"User with 'userId={staffId}' is not your staff", 403)

    password = randstr(8)
    staff.set_password(password)
    staff_json = staff.get_dict()
    staff_json["password"] = password

    Log.updated(staff, user, Tables.User, [("password", "***", "***")])

    return staff_json


@blueprint.route("/api/events/<int:eventId>/staff")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.get_staff_event)
@access_required("eventId")
def staff_event(eventId, db_sess: Session, user: User):
    users = User.all_event_staff(user, eventId)
    return jsonify_list(users)


@blueprint.route("/api/events/<int:eventId>/staff", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.change_staff_event)
@access_required("eventId")
def change_staff_event(eventId, db_sess: Session, user: User):
    new_staff = get_json_list_from_req()

    staff = User.all_user_staff(user)
    for s in staff:
        has_access = s.has_access(eventId)
        if s.id in new_staff:
            if not has_access:
                s.add_access(eventId, user, commit=False)
        else:
            if has_access:
                s.remove_access(eventId, user, commit=False)

    db_sess.commit()

    staff = User.all_event_staff(user, eventId)
    return jsonify_list(staff)
