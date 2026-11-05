from bafser import PublicError, create_file_response, doc_api, get_json_values, jsonify_list, protected_route, response_msg
from flask import Blueprint, abort, request

from data._operations import Operations
from data.font import Font, FontData
from data.user import User

blueprint = Blueprint("fonts", __name__)


@blueprint.route("/api/fonts")
@doc_api(res=list[FontData], desc="Шрифты")
@protected_route()
def fonts():
    fonts = Font.all()
    return jsonify_list(fonts)


@blueprint.route("/api/fonts/<int:fontId>")
@doc_api(res=bytes, desc="Скачать шрифт")
@protected_route()
def font(fontId: int):
    font = Font.get(fontId)
    if font is None:
        abort(404)

    return create_file_response(font.get_path(), f"font/{font.type}", font.get_filename())


@blueprint.post("/api/fonts")
@doc_api(res=FontData, desc="Загрузить шрифт")
@protected_route(perms=Operations.add_font)
def upload_font():
    user = User.current
    (name, type), values_error = get_json_values(request.form, ("name", str), ("type", str))
    if values_error:
        return response_msg(values_error, 400)

    file = request.files.get("font", None)
    if file is None:
        return response_msg("file font is None", 400)

    if type not in ["ttf", "otf", "woff", "woff2"]:
        return response_msg(f"font type [{type}] is not in [ttf, otf, woff, woff2]", 400)

    existing = Font.query(includeDeleted=True).filter(Font.name == name).first()
    if existing is not None:
        raise PublicError("Шрифт с таким названием уже существует", code="font_exists")

    font = Font.new(user, name, type, file)

    return font.get_dict()
