import os
from flask import Blueprint, abort, current_app, g, jsonify, send_file
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from data.operation import Operations
from utils import get_json_values, permission_required, use_db_session, use_user
from data.user import User
from data.image import Image

blueprint = Blueprint("images", __name__)


@blueprint.route("/api/img/<int:imgId>")
@jwt_required()
@use_db_session()
@use_user()
def img(db_sess: Session, user: User, imgId):
    img: Image = db_sess.query(Image).get(imgId)
    if not img:
        abort(404)

    if img.accessEventId is not None:
        if not user.has_access(img.accessEventId):
            abort(403)

    path = os.path.join(current_app.config["IMAGES_FOLDER"], f"{img.id}.{img.type}")
    filename = img.name + "." + img.type
    response = send_file(path)
    response.headers.set("Content-Type", f"image/{img.type}")
    response.headers.set("Content-Disposition", "inline", filename=filename)
    response.headers.set("Cache-Control", "public,max-age=31536000,immutable")
    return response


@blueprint.route("/api/img", methods=["POST"])
@jwt_required()
@use_db_session()
@use_user()
@permission_required(Operations.add_any_image)
def upload_img(db_sess: Session, user: User):
    data, is_json = g.json
    if not is_json:
        return jsonify({"msg": "body is not json"}), 415

    (img_data, ), values_error = get_json_values(data, "img")
    if values_error:
        return jsonify({"msg": values_error}), 400

    img, image_error = Image.new(db_sess, user, img_data)
    if image_error:
        return jsonify({"msg": image_error}), 400

    return jsonify({"id": img.id}), 200
