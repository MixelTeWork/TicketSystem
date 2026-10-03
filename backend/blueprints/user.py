from bafser import get_json_values_from_req, jsonify_list, protected_route, response_msg, use_db_session
from flask import Blueprint
from sqlalchemy.orm import Session

from data._operations import Operations
from data.user import User

blueprint = Blueprint("user", __name__)


@blueprint.route("/api/users")
@use_db_session
@protected_route(perms=Operations.page_debug_users)
def users(db_sess: Session):
    users = db_sess.query(User).all()
    return jsonify_list(users, "get_dict_full")


@blueprint.post("/api/user/change_password")
@use_db_session
@protected_route()
def change_password(db_sess: Session):
    user = User.current
    password = get_json_values_from_req(("password", str))

    user.update_password(user, password)

    return response_msg("ok")


@blueprint.post("/api/user/change_name")
@use_db_session
@protected_route()
def change_name(db_sess: Session):
    user = User.current
    name = get_json_values_from_req(("name", str))

    user.update_name(user, name)

    return response_msg("ok")
