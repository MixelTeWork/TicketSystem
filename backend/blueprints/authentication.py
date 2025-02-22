from flask import Blueprint, jsonify
from flask_jwt_extended import create_access_token, unset_jwt_cookies, set_access_cookies
from sqlalchemy.orm import Session

from bfs import get_json_values_from_req, response_msg, use_db_session
from data.user import User


blueprint = Blueprint("authentication", __name__)


@blueprint.post("/api/auth")
@use_db_session()
def login(db_sess: Session):
    login, password = get_json_values_from_req("login", "password")

    user = User.get_by_login(db_sess, login)

    if not user or not user.check_password(password):
        return response_msg("Неправильный логин или пароль"), 400

    response = jsonify(user.get_dict())
    access_token = create_access_token(identity=[user.id, user.password])
    set_access_cookies(response, access_token)
    return response


@blueprint.post("/api/logout")
def logout():
    response = response_msg("logout successful")
    unset_jwt_cookies(response)
    return response
