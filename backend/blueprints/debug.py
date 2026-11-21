import math
import os

from bafser import Log, TJson, doc_api, get_db_session, get_log_fpath, jsonify_list, protected_route
from flask import Blueprint, Response, request

import bafser_config
from data._operations import Operations

bp = Blueprint("debug", __name__)
PSIZE = 100
LOG_TAIL_MAX_BYTES = 256 * 1024


@bp.route("/api/debug/log")
@doc_api(res=list[dict], desc="Журнал действий")
@protected_route(perms=Operations.page_debug)
def debug_log():
    p = request.args.get("p", 0, type=int)
    if p < 0:
        return jsonify_list([])
    log = get_db_session().query(Log).order_by(Log.date.desc()).limit(PSIZE).offset(p * PSIZE).all()
    return jsonify_list(log)


@bp.route("/api/debug/log_len")
@doc_api(res=TJson["len", int], desc="Число страниц журнала")
@protected_route(perms=Operations.page_debug)
def debug_log_len():
    count = get_db_session().query(Log).count()
    return {"len": math.ceil(count / PSIZE)}


@bp.route("/api/debug/log_info")
@doc_api(desc="Информационный журнал")
@protected_route(perms=Operations.page_debug)
def debug_log_info():
    return _log_response(bafser_config.log_info_path)


@bp.route("/api/debug/log_requests")
@doc_api(desc="Журнал запросов")
@protected_route(perms=Operations.page_debug)
def debug_log_requests():
    return _log_response(bafser_config.log_requests_path)


@bp.route("/api/debug/log_errors")
@doc_api(desc="Журнал ошибок")
@protected_route(perms=Operations.page_debug)
def debug_log_errors():
    return _log_response(bafser_config.log_errors_path)


@bp.route("/api/debug/log_frontend")
@doc_api(desc="Журнал ошибок фронтенда")
@protected_route(perms=Operations.page_debug)
def debug_log_frontend():
    return _log_response(bafser_config.log_frontend_path)


def _log_response(path: str) -> Response:
    response = Response(last_n_lines(get_log_fpath(path), 256), mimetype="text/plain")
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


def last_n_lines(filename: str, n: int = 1) -> str:
    """Read a bounded UTF-8 suffix; a marker identifies an incomplete byte sample."""
    if n <= 0:
        return ""
    try:
        with open(filename, "rb") as source:
            source.seek(0, os.SEEK_END)
            start = max(0, source.tell() - LOG_TAIL_MAX_BYTES)
            # One preceding byte tells whether the suffix starts on a line boundary.
            source.seek(start - 1 if start else 0)
            data = source.read(LOG_TAIL_MAX_BYTES + (1 if start else 0))
    except FileNotFoundError:
        return ""  # Rotation can temporarily remove the active path.
    if start:
        previous, data = data[:1], data[1:]
        newline = data.find(b"\n")
        if previous != b"\n" and newline >= 0:
            data = data[newline + 1 :]
    text = data.decode("utf-8", errors="replace").replace("\r\n", "\n").replace("\r", "\n")
    tail = "".join(text.splitlines(keepends=True)[-n:])
    return ("[truncated: showing the end of the log]\n" if start else "") + tail
