from bafser import get_json_values_from_req, protected_route, response_msg, use_db_session
from flask import Blueprint, abort
from sqlalchemy.orm import Session

from data._operations import Operations
from data.img import Image
from data.user import User

blueprint = Blueprint("images", __name__)


@blueprint.route("/api/img/<int:imgId>")
@use_db_session
@protected_route()
def img(db_sess: Session, imgId):
    user = User.current
    img = Image.get(db_sess, imgId)
    if img is None:
        abort(404)

    if img.accessEventId is not None:
        if not user.has_access(img.accessEventId):
            abort(403)

    return img.create_file_response()


@blueprint.post("/api/img")
@use_db_session
@protected_route(perms=Operations.add_any_image)
def upload_img(db_sess: Session):
    user = User.current
    img_data = get_json_values_from_req(("img", dict))

    img, image_error = Image.new(user, img_data)
    if image_error:
        return response_msg(image_error, 400)

    return {"id": img.id}
