from flask import Blueprint, abort, g, jsonify
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.event import Event
from data.log import Actions, Log, Tables
from data.operation import Operations
from data.ticket import Ticket
from data.ticket_type import TicketType
from data.user import User
from utils import get_datetime_now, get_json_values, permission_required, use_db_session, use_user


blueprint = Blueprint("users", __name__)


@blueprint.route("/api/users")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_users)
def users(db_sess: Session, user: User):
    users = db_sess.query(User).all()
    return jsonify(list(map(lambda x: x.get_dict(), users))), 200

