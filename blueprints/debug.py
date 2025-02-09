from flask import Blueprint
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session

from bfs import Log, permission_required, use_db_session, use_user, jsonify_list
from data._operations import Operations
from data.user import User


blueprint = Blueprint("debug", __name__)


@blueprint.route("/api/debug/log")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_debug)
def debug_log(db_sess: Session, user: User):
    log = db_sess.query(Log).order_by(Log.date.desc()).all()
    return jsonify_list(log)


@blueprint.route("/api/debug/log_info")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_debug)
def debug_log_info(db_sess: Session, user: User):
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
