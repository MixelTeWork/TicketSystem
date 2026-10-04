from bafser import TJson, create_access_token, doc_api, get_json_values_from_req, response_msg
from flask import Blueprint, jsonify
from flask_jwt_extended import set_access_cookies, unset_jwt_cookies

from data.user import User, UserData

blueprint = Blueprint("authentication", __name__)


@blueprint.post("/api/auth")
@doc_api(req=TJson["login", str, "password", str], res=UserData, desc="Вход в систему")
def login():
    login, password = get_json_values_from_req(("login", str), ("password", str))

    user = User.get_by_login(login)

    if not user or not user.check_password(password):
        return response_msg("Неправильный логин или пароль"), 400

    response = jsonify(user.get_dict())
    access_token = create_access_token(user)
    set_access_cookies(response, access_token)
    return response


@blueprint.post("/api/logout")
@doc_api(desc="Выход из системы")
def logout():
    response = response_msg("logout successful")
    unset_jwt_cookies(response)
    return response
