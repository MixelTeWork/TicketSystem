from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from data import db_session
import logging
from data.event import Event

from data.user import User


blueprint = Blueprint("api", __name__)


@blueprint.route("/api/user")
@jwt_required()
def user():
    user_id = get_jwt_identity()

    db_sess = db_session.create_session()
    user: User = db_sess.query(User).filter(User.id == user_id).first()

    return jsonify(user.get_dict()), 200


@blueprint.route("/api/events")
@jwt_required()
def events():
    db_sess = db_session.create_session()
    events = db_sess.query(Event).all()

    return jsonify(list(map(lambda x: x.get_dict(), events))), 200
