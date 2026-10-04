import math

from bafser import Log, TJson, doc_api, get_db_session, get_log_fpath, jsonify_list, protected_route
from flask import Blueprint, request

import bafser_config
from data._operations import Operations

blueprint = Blueprint("debug", __name__)
PSIZE = 100


@blueprint.route("/api/debug/log")
@doc_api(res=list[dict], desc="Журнал действий")
@protected_route(perms=Operations.page_debug)
def debug_log():
    p = request.args.get("p", 0, type=int)
    if p < 0:
        return jsonify_list([])
    log = get_db_session().query(Log).order_by(Log.date.desc()).limit(PSIZE).offset(p * PSIZE).all()
    return jsonify_list(log)


@blueprint.route("/api/debug/log_len")
@doc_api(res=TJson["len", int], desc="Число страниц журнала")
@protected_route(perms=Operations.page_debug)
def debug_log_len():
    count = get_db_session().query(Log).count()
    return {"len": math.ceil(count / PSIZE)}


@blueprint.route("/api/debug/log_info")
@doc_api(desc="Информационный журнал")
@protected_route(perms=Operations.page_debug)
def debug_log_info():
    return last_n_lines(get_log_fpath(bafser_config.log_info_path), 256)


@blueprint.route("/api/debug/log_requests")
@doc_api(desc="Журнал запросов")
@protected_route(perms=Operations.page_debug)
def debug_log_requests():
    return last_n_lines(get_log_fpath(bafser_config.log_requests_path), 256)


@blueprint.route("/api/debug/log_errors")
@doc_api(desc="Журнал ошибок")
@protected_route(perms=Operations.page_debug)
def debug_log_errors():
    return last_n_lines(get_log_fpath(bafser_config.log_errors_path), 256)


@blueprint.route("/api/debug/log_frontend")
@doc_api(desc="Журнал ошибок фронтенда")
@protected_route(perms=Operations.page_debug)
def debug_log_frontend():
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
