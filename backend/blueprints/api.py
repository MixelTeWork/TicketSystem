from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy.orm import Session
import logging
from utils import use_db_session
from data.event import Event
from data.user import User


blueprint = Blueprint("api", __name__)


@blueprint.route("/api/user")
@jwt_required()
@use_db_session()
def user(db_sess: Session):
    user_id = get_jwt_identity()
    user: User = db_sess.query(User).filter(User.id == user_id).first()
    return jsonify(user.get_dict()), 200


@blueprint.route("/api/events")
@jwt_required()
@use_db_session()
def events(db_sess: Session):
    events = db_sess.query(Event).all()
    return jsonify(list(map(lambda x: x.get_dict(), events))), 200
