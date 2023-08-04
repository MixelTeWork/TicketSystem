from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from data import db_session
import logging


blueprint = Blueprint("api", __name__)


@blueprint.route("/api/test", methods=["GET"])
def test():
    return jsonify({"result": "OK"}), 200


@blueprint.route("/api/test2", methods=["GET"])
@jwt_required()
def test2():
    return jsonify({"result": "OK"}), 200


@blueprint.route("/api/test2", methods=["POST"])
@jwt_required()
def test3():
    return jsonify({"result": "OK"}), 200
