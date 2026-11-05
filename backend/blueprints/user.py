from bafser import TJson, doc_api, get_json_values_from_req, jsonify_list, protected_route, response_msg
from flask import Blueprint
from sqlalchemy import orm

from data._operations import Operations
from data.user import FullUserData, User

blueprint = Blueprint("user", __name__)


@blueprint.route("/api/users")
@doc_api(res=list[FullUserData], desc="Список пользователей")
@protected_route(perms=Operations.page_debug_users)
def users():
    users = User.query(includeDeleted=True).options(*User.list_options(), orm.selectinload(User.access)).all()
    return jsonify_list(users, "get_dict_full")


@blueprint.post("/api/user/change_password")
@doc_api(req=TJson["password", str], res=TJson["msg", str], desc="Изменить пароль")
@protected_route()
def change_password():
    user = User.current
    password = get_json_values_from_req(("password", str))

    user.update_password(user, password)

    return response_msg("ok")


@blueprint.post("/api/user/change_name")
@doc_api(req=TJson["name", str], res=TJson["msg", str], desc="Изменить имя")
@protected_route()
def change_name():
    user = User.current
    name = get_json_values_from_req(("name", str))

    user.update_name(user, name)

    return response_msg("ok")
