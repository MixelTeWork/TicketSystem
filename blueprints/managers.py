from flask import Blueprint
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session

from bafser import get_json_values_from_req, jsonify_list, permission_required, randstr, response_msg, response_not_found, use_db_session, use_user
from data._operations import Operations
from data._roles import Roles
from data.user import User


blueprint = Blueprint("managers", __name__)


@blueprint.route("/api/managers")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_managers)
def managers(db_sess: Session, user: User):
    users = User.all_managers(db_sess)
    return jsonify_list(users)


@blueprint.post("/api/managers")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.add_manager)
def add_managers(db_sess: Session, user: User):
    name, login = get_json_values_from_req("name", "login")

    existing_user = User.get_by_login(db_sess, login, includeDeleted=True)
    if existing_user is not None:
        return response_msg(f"User with login '{login}' already exist", 400)

    password = randstr(8)
    manager = User.new(user, login, password, name, [Roles.manager])

    manager_json = manager.get_dict()
    manager_json["password"] = password

    return manager_json


@blueprint.delete("/api/managers/<int:managerId>")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.delete_manager)
def delete_manager(managerId, db_sess: Session, user: User):
    manager = User.get(db_sess, managerId)
    if manager is None:
        return response_not_found("user", managerId)

    manager.delete(user)

    return response_msg("ok")
