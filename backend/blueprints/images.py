import os
from flask import Blueprint, abort, current_app, jsonify, request, send_file
from flask_jwt_extended import jwt_required
from sqlalchemy.orm import Session
from utils import get_datetime_now, use_db_session, use_user
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
def upload_img(db_sess: Session, user: User):
    if len(request.files) == 0 or not ("img" in request.files):
        return jsonify({"msg": "no 'img' file"}), 400

    accessEventId = request.form.get("accessEventId", None)
    if accessEventId.strip() == "":
        accessEventId = None
    name = request.form.get("name", None)
    file = request.files["img"]
    mimetype = file.content_type

    if mimetype not in ["image/png", "image/jpeg", "image/gif"]:
        return jsonify({"msg": "img mimetype is not in [image/png, image/jpeg, image/gif]"}), 400

    img_type = mimetype.split("/")[1]

    img = Image(name=name, type=img_type, accessEventId=accessEventId, createdById=user.id, creationDate=get_datetime_now())
    db_sess.add(img)
    db_sess.commit()

    path = os.path.join(current_app.config["IMAGES_FOLDER"], f"{img.id}.{img_type}")
    file.save(path)

    return jsonify({"id": img.id}), 200
