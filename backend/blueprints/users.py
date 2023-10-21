from flask import Blueprint, g, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.log import Actions, Log, Tables
from data.operation import Operations
from data.role import Roles
from data.user import User
from utils import get_datetime_now, get_json_values, permission_required, randstr, use_db_session, use_user


blueprint = Blueprint("users", __name__)


@blueprint.route("/api/users")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_users)
def users(db_sess: Session, user: User):
    users = db_sess.query(User).all()
    return jsonify(list(map(lambda x: x.get_dict_full(), users))), 200


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
    staff = User(login=login, name=name, bossId=user.id, roleId=Roles.clerk)
    staff.set_password(password)
    db_sess.add(staff)

    log = Log(
        date=get_datetime_now(),
        actionCode=Actions.added,
        userId=user.id,
        userName=user.name,
        tableName=Tables.User,
        recordId=-1,
        changes=staff.get_creation_changes()
    )
    db_sess.add(log)
    db_sess.commit()
    log.recordId = staff.id
    db_sess.commit()

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
