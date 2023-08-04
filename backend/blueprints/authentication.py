from flask import Blueprint, jsonify, request
from flask_jwt_extended import create_access_token, unset_jwt_cookies, set_access_cookies
from data import db_session
import logging

blueprint = Blueprint("authentication", __name__)


@blueprint.route("/api/login", methods=["POST"])
def login():
    response = jsonify({"msg": "login successful"})
    access_token = create_access_token(identity="example_user")
    set_access_cookies(response, access_token)
    return response


@blueprint.route("/api/logout", methods=["POST"])
def logout():
    response = jsonify({"msg": "logout successful"})
    unset_jwt_cookies(response)
    return response
