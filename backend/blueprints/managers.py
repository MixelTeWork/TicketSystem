from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.operation import Operations
from data.role import Roles
from data.user import User
from utils import get_json_values_from_req, jsonify_list, permission_required, randstr, response_msg, response_not_found, use_db_session, use_user


blueprint = Blueprint("managers", __name__)


@blueprint.route("/api/managers")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_managers)
def managers(db_sess: Session, user: User):
    users = User.all_managers(db_sess)
    return jsonify_list(users), 200


@blueprint.route("/api/manager", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.add_manager)
def add_managers(db_sess: Session, user: User):
    (name, login), errorRes = get_json_values_from_req("name", "login")
    if errorRes:
        return errorRes

    existing_user = User.get_by_login(db_sess, login, includeDeleted=True)
    if existing_user is not None:
        return response_msg(f"User with login '{login}' already exist"), 400

    password = randstr(8)
    manager = User.new(db_sess, user, login, password, name, [Roles.manager])

    manager_json = manager.get_dict()
    manager_json["password"] = password

    return jsonify(manager_json), 200


@blueprint.route("/api/manager/<int:managerId>", methods=["DELETE"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.delete_manager)
def delete_manager(managerId, db_sess: Session, user: User):
    manager = User.get(db_sess, managerId)
    if manager is None:
        return response_not_found("user", managerId)

    manager.delete(user)

    return response_msg("ok"), 200
