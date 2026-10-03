from bafser import (
    create_file_response,
    get_json_values,
    jsonify_list,
    protected_route,
    response_msg,
    use_db_session,
)
from flask import Blueprint, abort, request
from sqlalchemy.orm import Session

from data._operations import Operations
from data.font import Font
from data.user import User

blueprint = Blueprint("fonts", __name__)


@blueprint.route("/api/fonts")
@use_db_session
@protected_route()
def fonts(db_sess: Session):
    fonts = Font.all(db_sess)
    return jsonify_list(fonts)


@blueprint.route("/api/fonts/<int:fontId>")
@use_db_session
@protected_route()
def font(db_sess: Session, fontId):
    font = Font.get(db_sess, fontId)
    if font is None:
        abort(404)

    return create_file_response(font.get_path(), f"font/{font.type}", font.get_filename())


@blueprint.post("/api/fonts")
@use_db_session
@protected_route(perms=Operations.add_font)
def upload_font(db_sess: Session):
    user = User.current
    (name, type), values_error = get_json_values(request.form, ("name", str), ("type", str))
    if values_error:
        return response_msg(values_error, 400)

    file = request.files.get("font", None)
    if file is None:
        return response_msg("file font is None", 400)

    if type not in ["ttf", "otf", "woff", "woff2"]:
        return response_msg(f"font type [{type}] is not in [ttf, otf, woff, woff2]", 400)

    existing = db_sess.query(Font).filter(Font.name == name).first()
    if existing is not None:
        return response_msg(f"font with name [{name}] already exist", 400)

    font = Font.new(user, name, type, file)

    return font.get_dict()
