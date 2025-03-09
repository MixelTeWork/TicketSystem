import math
from flask import Blueprint, request
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session

import bfs_config
from bfs import Log, get_log_fpath, jsonify_list, permission_required, use_db_session, use_user
from data._operations import Operations
from data.user import User


blueprint = Blueprint("debug", __name__)
PSIZE = 100


@blueprint.route("/api/debug/log")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_debug)
def debug_log(db_sess: Session, user: User):
    p = request.args.get("p", 0, type=int)
    if p < 0:
        return jsonify_list([])
    log = db_sess.query(Log).order_by(Log.date.desc()).limit(PSIZE).offset(p * PSIZE).all()
    return jsonify_list(log)


@blueprint.route("/api/debug/log_len")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_debug)
def debug_log_len(db_sess: Session, user: User):
    count = db_sess.query(Log).count()
    return {"len": math.ceil(count / PSIZE)}


@blueprint.route("/api/debug/log_info")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_debug)
def debug_log_info(db_sess: Session, user: User):
    return last_n_lines(get_log_fpath(bfs_config.log_info_path), 256)


@blueprint.route("/api/debug/log_requests")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_debug)
def debug_log_requests(db_sess: Session, user: User):
    return last_n_lines(get_log_fpath(bfs_config.log_requests_path), 256)


@blueprint.route("/api/debug/log_errors")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_debug)
def debug_log_errors(db_sess: Session, user: User):
    return last_n_lines(get_log_fpath(bfs_config.log_errors_path), 256)


@blueprint.route("/api/debug/log_frontend")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_debug)
def debug_log_frontend(db_sess: Session, user: User):
    return last_n_lines(get_log_fpath(bfs_config.log_frontend_path), 256)


def last_n_lines(filename, n=1):
    lines = ["" for _ in range(n)]
    i = 0
    with open(filename, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            lines[i] = line
            i += 1
            i = i % n
    return "".join(lines[(j + i) % n] for j in range(n))
