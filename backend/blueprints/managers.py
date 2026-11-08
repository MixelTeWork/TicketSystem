from bafser import TJson, doc_api, get_json_values_from_req, jsonify_list, protected_route, randstr, response_msg, response_not_found
from flask import Blueprint

from data._operations import Operations
from data._roles import Roles
from data.user import User, UserData, UserWithPasswordData

blueprint = Blueprint("managers", __name__)


@blueprint.route("/api/managers")
@doc_api(res=list[UserData], desc="Менеджеры")
@protected_route(perms=Operations.page_managers)
def managers():
    users = User.all_managers()
    return jsonify_list(users)


@blueprint.post("/api/managers")
@doc_api(req=TJson["name", str, "login", str], res=UserWithPasswordData, desc="Добавить менеджера")
@protected_route(perms=Operations.add_manager)
def add_managers():
    user = User.current
    name, login = get_json_values_from_req(("name", str), ("login", str))

    existing_user = User.get_by_login(login, includeDeleted=True)
    if existing_user is not None:
        return response_msg(f"User with login '{login}' already exist", 400)

    password = randstr(8)
    manager = User.new(user, login, password, name, [Roles.manager])

    manager_json = manager.get_dict()
    manager_json["password"] = password

    return manager_json


@blueprint.delete("/api/managers/<int:managerId>")
@doc_api(res=TJson["msg", str], desc="Удалить менеджера")
@protected_route(perms=Operations.delete_manager)
def delete_manager(managerId: int):
    user = User.current
    manager = User.get(managerId)
    if manager is None:
        return response_not_found("user", managerId)

    if manager.id == user.id or manager.is_admin() or manager.has_role(Roles.owner) or not manager.has_role(Roles.manager):
        return response_msg("Cannot delete this user as a manager", 403)

    manager.delete(user)

    return response_msg("ok")
