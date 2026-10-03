import math

from bafser import Log, get_log_fpath, jsonify_list, protected_route, use_db_session
from flask import Blueprint, request
from sqlalchemy.orm import Session

import bafser_config
from data._operations import Operations

blueprint = Blueprint("debug", __name__)
PSIZE = 100


@blueprint.route("/api/debug/log")
@use_db_session
@protected_route(perms=Operations.page_debug)
def debug_log(db_sess: Session):
    p = request.args.get("p", 0, type=int)
    if p < 0:
        return jsonify_list([])
    log = db_sess.query(Log).order_by(Log.date.desc()).limit(PSIZE).offset(p * PSIZE).all()
    return jsonify_list(log)


@blueprint.route("/api/debug/log_len")
@use_db_session
@protected_route(perms=Operations.page_debug)
def debug_log_len(db_sess: Session):
    count = db_sess.query(Log).count()
    return {"len": math.ceil(count / PSIZE)}


@blueprint.route("/api/debug/log_info")
@use_db_session
@protected_route(perms=Operations.page_debug)
def debug_log_info(db_sess: Session):
    return last_n_lines(get_log_fpath(bafser_config.log_info_path), 256)


@blueprint.route("/api/debug/log_requests")
@use_db_session
@protected_route(perms=Operations.page_debug)
def debug_log_requests(db_sess: Session):
    return last_n_lines(get_log_fpath(bafser_config.log_requests_path), 256)


@blueprint.route("/api/debug/log_errors")
@use_db_session
@protected_route(perms=Operations.page_debug)
def debug_log_errors(db_sess: Session):
    return last_n_lines(get_log_fpath(bafser_config.log_errors_path), 256)


@blueprint.route("/api/debug/log_frontend")
@use_db_session
@protected_route(perms=Operations.page_debug)
def debug_log_frontend(db_sess: Session):
    return last_n_lines(get_log_fpath(bafser_config.log_frontend_path), 256)


def last_n_lines(filename, n=1):
    lines = ["" for _ in range(n)]
    i = 0
    with open(filename, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            lines[i] = line
            i += 1
            i = i % n
    return "".join(lines[(j + i) % n] for j in range(n))
