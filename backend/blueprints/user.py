from flask import Blueprint
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.operation import Operations
from data.user import User
from utils import get_json_values_from_req, jsonify_list, permission_required, response_msg, use_db_session, use_user


blueprint = Blueprint("user", __name__)


@blueprint.route("/api/users")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_debug_users)
def users(db_sess: Session, user: User):
    users = db_sess.query(User).all()
    return jsonify_list(users, "get_dict_full"), 200


@blueprint.route("/api/user/change_password", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
def change_password(db_sess: Session, user: User):
    (password, ), errorRes = get_json_values_from_req("password")
    if errorRes:
        return errorRes

    user.update_password(user, password)

    return response_msg("ok"), 200


@blueprint.route("/api/user/change_name", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
def change_name(db_sess: Session, user: User):
    (name, ), errorRes = get_json_values_from_req("name")
    if errorRes:
        return errorRes

    user.update_name(user, name)

    return response_msg("ok"), 200
