from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, unset_jwt_cookies, set_access_cookies
import logging
from data import db_session
from data.user import User
from utils import get_json, get_json_values


blueprint = Blueprint("authentication", __name__)


@blueprint.route("/api/auth", methods=["POST"])
def login():
    data, is_json = get_json(request)
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    (login, password), values_error = get_json_values(data, "login", "password")

    if values_error:
        return jsonify({"msg": values_error}), 400

    db_sess = db_session.create_session()
    user: User = db_sess.query(User).filter(User.login == login).first()

    if not user or not user.check_password(password):
        return jsonify({"msg": "Неправильный логин или пароль"}), 400

    logging.info(f"Logged in {user}")
    response = jsonify(user.to_dict(only=("name", "login")))
    access_token = create_access_token(identity=user.id)
    set_access_cookies(response, access_token)
    return response


@blueprint.route("/api/logout", methods=["POST"])
def logout():
    response = jsonify({"msg": "logout successful"})
    unset_jwt_cookies(response)
    return response
