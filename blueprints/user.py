from flask import Blueprint, g, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.log import Actions, Log, Tables
from data.operation import Operations
from data.user import User
from utils import get_datetime_now, get_json_values, permission_required, use_db_session, use_user


blueprint = Blueprint("user", __name__)


@blueprint.route("/api/users")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_users)
def users(db_sess: Session, user: User):
    users = db_sess.query(User).all()
    return jsonify(list(map(lambda x: x.get_dict_full(), users))), 200


@blueprint.route("/api/user/change_password", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
def change_password(db_sess: Session, user: User):
    data, is_json = g.json
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    (password, ), values_error = get_json_values(data, "password")

    if values_error:
        return jsonify({"msg": values_error}), 400

    user.set_password(password)

    db_sess.add(Log(
        date=get_datetime_now(),
        actionCode=Actions.updated,
        userId=user.id,
        userName=user.name,
        tableName=Tables.User,
        recordId=user.id,
        changes=[("password", "***", "***")]
    ))
    db_sess.commit()

    return "", 200


@blueprint.route("/api/user/change_name", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
def change_name(db_sess: Session, user: User):
    data, is_json = g.json
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    (name, ), values_error = get_json_values(data, "name")

    if values_error:
        return jsonify({"msg": values_error}), 400

    pastName = user.name
    user.name = name

    db_sess.add(Log(
        date=get_datetime_now(),
        actionCode=Actions.updated,
        userId=user.id,
        userName=user.name,
        tableName=Tables.User,
        recordId=user.id,
        changes=[("name", pastName, name)]
    ))
    db_sess.commit()

    return "", 200
