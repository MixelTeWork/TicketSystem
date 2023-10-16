from flask import Blueprint
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.operation import Operations
from data.user import User

from utils import permission_required, use_db_session, use_user


blueprint = Blueprint("debug", __name__)


@blueprint.route("/api/debug/log")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_debug)
def debug_log(db_sess: Session, user: User):
    return last_n_lines("log_info.csv", 256)


@blueprint.route("/api/debug/log_errors")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_debug)
def debug_log_errors(db_sess: Session, user: User):
    return last_n_lines("log_errors.log", 256)


def last_n_lines(filename, n=1):
    lines = ["" for _ in range(n)]
    i = 0
    with open(filename, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            lines[i] = line
            i += 1
            i = i % n
    return "".join(lines[(j + i) % n] for j in range(n))
