import os
from flask import Blueprint, jsonify, make_response, send_file
from flask_jwt_extended import jwt_required
from mysqlx import Session
from data.event import Event
from data.operation import Operations
from data.ticket import Ticket
from data.user import User

from utils import permission_required, use_db_session, use_user


blueprint = Blueprint("debug", __name__)


@blueprint.route("/api/debug/log")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_debug)
def debug_log(db_sess: Session, user: User):
    try:
        return read_lines_from_end("log_info.csv", 512)
    except:
        try:
            return read_n_to_last_line("log_info.log", 512)
        except:
            return send_file("log_info.csv")


@blueprint.route("/api/debug/log_errors")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_debug)
def debug_log_errors(db_sess: Session, user: User):
    try:
        return read_lines_from_end("log_errors.csv", 512)
    except:
        try:
            return read_n_to_last_line("log_errors.log", 512)
        except:
            return send_file("log_errors.csv")


@blueprint.route("/api/debug/clear_scanned/<int:eventId>")
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.page_debug)
def debug_clear_scanned(db_sess: Session, user: User, eventId):
    tickets: list[Ticket] = db_sess.query(Ticket).filter(Event.id == eventId).all()
    for ticket in tickets:
        ticket.scanned = False
    db_sess.commit()
    return jsonify({"msg": "ok"})


def read_n_to_last_line(filename, n=1):
    """Returns the nth before last line of a file (n=1 gives last line)"""
    num_newlines = 0
    with open(filename, 'rb') as f:
        try:
            f.seek(-2, os.SEEK_END)
            while num_newlines < n:
                f.seek(-2, os.SEEK_CUR)
                if f.read(1) == b'\n':
                    num_newlines += 1
        except OSError:
            f.seek(0)
        lines = f.read().decode()
    return lines


def read_lines_from_end(filename, n=1):
    lines = 0
    with open(filename, "r", encoding="utf-8") as f:
        try:
            line = f.readline()
            while line is not None:
                lines += 1
                line = f.readline()
        except Exception as x:
            pass
    with open(filename, "r", encoding="utf-8") as f:
        i = 0
        while i < lines - n:
            i += 1
            f.readline()
        r = ""
        try:
            while True:
                line = f.readline()
                r += line
        except Exception:
            pass
        return r
