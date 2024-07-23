from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.log import Actions, Log, Tables
from data.operation import Operations
from data.user import User
from utils import get_datetime_now, get_json_values_from_req, permission_required, response_msg, use_db_session, use_user


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
    (password, ), errorRes = get_json_values_from_req("password")
    if errorRes:
        return errorRes

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

    return response_msg("ok"), 200


@blueprint.route("/api/user/change_name", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
def change_name(db_sess: Session, user: User):
    (name, ), errorRes = get_json_values_from_req("name")
    if errorRes:
        return errorRes

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

    return response_msg("ok"), 200
