from flask import Blueprint, abort, jsonify, send_file, request
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.log import Actions, Log, Tables
from data.operation import Operations
from utils import get_datetime_now, get_json_values, permission_required, use_db_session, use_user
from data.user import User
from data.font import Font

blueprint = Blueprint("fonts", __name__)


@blueprint.route("/api/fonts")
@jwt_required()
@use_db_session()
@use_user()
def fonts(db_sess: Session, user: User):
    fonts = db_sess.query(Font).filter(Font.deleted == False).all()
    return jsonify(list(map(lambda x: x.get_dict(), fonts))), 200


@blueprint.route("/api/font/<int:fontId>")
@jwt_required()
@use_db_session()
@use_user()
def font(db_sess: Session, user: User, fontId):
    font: Font = db_sess.query(Font).get(fontId)
    if not font or font.deleted:
        abort(404)

    path = font.get_path()
    filename = font.name + "." + font.type
    response = send_file(path)
    response.headers.set("Content-Type", f"font/{font.type}")
    response.headers.set("Content-Disposition", "inline", filename=filename)
    response.headers.set("Cache-Control", "public,max-age=31536000,immutable")
    return response


@blueprint.route("/api/font", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.add_font)
def upload_font(db_sess: Session, user: User):
    (name, type), values_error = get_json_values(request.form, "name", "type")
    if values_error:
        return jsonify({"msg": values_error}), 400

    file = request.files.get("font", None)
    if file is None:
        return jsonify({"msg": "file font is None"}), 400

    if type not in ["ttf", "woff", "woff2"]:
        return jsonify({"msg": f"font type [{type}] is not in [ttf, woff, woff2]"}), 400

    now = get_datetime_now()
    font = Font(name=name, type=type, creationDate=now, createdById=user.id)
    db_sess.add(font)

    log = Log(
        date=now,
        actionCode=Actions.added,
        userId=user.id,
        userName=user.name,
        tableName=Tables.Font,
        recordId=-1,
        changes=font.get_creation_changes()
    )
    db_sess.add(log)
    db_sess.commit()

    path = font.get_path()
    file.save(path)
    fontId = font.id
    log.recordId = fontId

    db_sess.commit()

    return font.get_dict(), 200
