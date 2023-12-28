from flask import Blueprint, g, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.log import Actions, Log, Tables
from data.operation import Operations
from data.permission_access import PermissionAccess
from data.role import Roles
from data.user import User
from utils import get_datetime_now, get_json_values, permission_required, randstr, use_db_session, use_user


blueprint = Blueprint("staff", __name__)


@blueprint.route("/api/staff")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_staff)
def staff(db_sess: Session, user: User):
    users = db_sess.query(User).filter(User.deleted == False, User.bossId == user.id).all()
    return jsonify(list(map(lambda x: x.get_dict(), users))), 200


@blueprint.route("/api/staff", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.add_staff)
def add_staff(db_sess: Session, user: User):
    data, is_json = g.json
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    (name, login), values_error = get_json_values(data, "name", "login")

    if values_error:
        return jsonify({"msg": values_error}), 400

    existing_user = db_sess.query(User).filter(User.login == login).first()
    if existing_user is not None:
        return jsonify({"msg": f"User with login {login} already exist", "exist": True}), 400

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
def delete_event(staffId, db_sess: Session, user: User):
    staff = db_sess.query(User).filter(User.deleted == False, User.id == staffId).first()
    if staff is None:
        return jsonify({"msg": f"User with 'userId={staffId}' not found"}), 400

    if staff.bossId != user.id:
        return jsonify({"msg": f"User with 'userId={staffId}' is not your staff"}), 403

    staff.deleted = True

    db_sess.add(Log(
        date=get_datetime_now(),
        actionCode=Actions.deleted,
        userId=user.id,
        userName=user.name,
        tableName=Tables.User,
        recordId=staff.id,
        changes=[]
    ))
    db_sess.commit()

    return "", 200


@blueprint.route("/api/staff/reset_password/<int:staffId>", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.change_staff)
def reset_password(staffId, db_sess: Session, user: User):
    staff = db_sess.query(User).filter(User.deleted == False, User.id == staffId).first()
    if staff is None:
        return jsonify({"msg": f"User with 'userId={staffId}' not found"}), 400

    if staff.bossId != user.id:
        return jsonify({"msg": f"User with 'userId={staffId}' is not your staff"}), 403

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


@blueprint.route("/api/event/staff/<int:eventId>")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.get_staff_event, "eventId")
def staff_event(eventId, db_sess: Session, user: User):
    users = db_sess.query(User).filter(User.deleted == False, User.bossId == user.id, User.access.any(PermissionAccess.eventId == eventId)).all()
    return jsonify(list(map(lambda x: x.get_dict(), users))), 200


@blueprint.route("/api/event/staff/<int:eventId>", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.change_staff_event, "eventId")
def change_staff_event(eventId, db_sess: Session, user: User):
    new_staff, is_json = g.json
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    if not isinstance(new_staff, list):
        return jsonify({"msg": "body is not json list"}), 400

    staff = db_sess.query(User).filter(User.deleted == False, User.bossId == user.id).all()
    for s in staff:
        has_access = s.has_access(eventId)
        if s.id in new_staff:
            if has_access:
                continue
            s.add_access(db_sess, eventId, user)
        else:
            if not has_access:
                continue
            s.remove_access(db_sess, eventId, user)

    db_sess.commit()

    staff = db_sess.query(User).filter(User.deleted == False, User.bossId == user.id, User.access.any(PermissionAccess.eventId == eventId)).all()
    return jsonify(list(map(lambda x: x.get_dict(), staff))), 200
