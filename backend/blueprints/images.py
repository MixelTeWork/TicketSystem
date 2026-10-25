from bafser import TJson, doc_api, get_json_values_from_req, protected_route, response_msg
from flask import Blueprint, abort

from data._operations import Operations
from data.img import Image
from data.user import User

blueprint = Blueprint("images", __name__)


@blueprint.route("/api/img/<int:imgId>")
@doc_api(res=bytes, desc="Скачать изображение")
@protected_route()
def img(imgId: int):
    user = User.current
    img = Image.get(imgId)
    if img is None:
        abort(404)

    if img.accessEventId is not None:
        if not user.has_access(img.accessEventId):
            abort(403)

    return img.create_file_response()


@blueprint.post("/api/img")
@doc_api(req=TJson["img", dict], res=TJson["id", int], desc="Загрузить изображение")
@protected_route(perms=Operations.add_any_image)
def upload_img():
    user = User.current
    img_data = get_json_values_from_req(("img", dict))

    img, image_error = Image.new(user, img_data)
    if image_error:
        return response_msg(image_error, 400)

    return {"id": img.id}
