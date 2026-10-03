from bafser import get_json_values_from_req, jsonify_list, protected_route, randstr, response_msg, response_not_found, use_db_session
from flask import Blueprint
from sqlalchemy.orm import Session

from data._operations import Operations
from data._roles import Roles
from data.user import User

blueprint = Blueprint("managers", __name__)


@blueprint.route("/api/managers")
@use_db_session
@protected_route(perms=Operations.page_managers)
def managers(db_sess: Session):
    users = User.all_managers(db_sess)
    return jsonify_list(users)


@blueprint.post("/api/managers")
@use_db_session
@protected_route(perms=Operations.add_manager)
def add_managers(db_sess: Session):
    user = User.current
    name, login = get_json_values_from_req(("name", str), ("login", str))

    existing_user = User.get_by_login(db_sess, login, includeDeleted=True)
    if existing_user is not None:
        return response_msg(f"User with login '{login}' already exist", 400)

    password = randstr(8)
    manager = User.new(user, login, password, name, [Roles.manager])

    manager_json = manager.get_dict()
    manager_json["password"] = password

    return manager_json


@blueprint.delete("/api/managers/<int:managerId>")
@use_db_session
@protected_route(perms=Operations.delete_manager)
def delete_manager(managerId, db_sess: Session):
    user = User.current
    manager = User.get(db_sess, managerId)
    if manager is None:
        return response_not_found("user", managerId)

    manager.delete(user)

    return response_msg("ok")
