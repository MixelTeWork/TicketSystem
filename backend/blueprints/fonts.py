from flask import Blueprint, abort, jsonify, send_file, request
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.operation import Operations
from utils import get_json_values, permission_required, response_msg, use_db_session, use_user
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


@blueprint.route("/api/fonts/<int:fontId>")
@jwt_required()
@use_db_session()
@use_user()
def font(db_sess: Session, user: User, fontId):
    font = Font.get(db_sess, fontId)
    if font is None:
        abort(404)

    path = font.get_path()
    filename = font.get_filename()
    response = send_file(path)
    response.headers.set("Content-Type", f"font/{font.type}")
    response.headers.set("Content-Disposition", "inline", filename=filename)
    response.headers.set("Cache-Control", "public,max-age=31536000,immutable")
    return response


@blueprint.route("/api/fonts", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.add_font)
def upload_font(db_sess: Session, user: User):
    (name, type), values_error = get_json_values(request.form, "name", "type")
    if values_error:
        return response_msg(values_error), 400

    file = request.files.get("font", None)
    if file is None:
        return response_msg("file font is None"), 400

    if type not in ["ttf", "otf", "woff", "woff2"]:
        return response_msg(f"font type [{type}] is not in [ttf, otf, woff, woff2]"), 400

    existing = db_sess.query(Font).filter(Font.name == name).first()
    if existing is not None:
        return response_msg(f"font with name [{name}] already exist"), 400

    font = Font.new(db_sess, user, name, type, file)

    return font.get_dict(), 200
