import base64
import os
from typing import TypedDict
from flask import current_app
from sqlalchemy import Column, String, orm, ForeignKey, Integer, DateTime
from sqlalchemy_serializer import SerializerMixin

from utils import get_datetime_now, get_json_values
from .db_session import SqlAlchemyBase


class ImageJson(TypedDict):
    data: str
    name: str
    accessEventId: int


class Image(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Image"

    id            = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    name          = Column(String(128), nullable=False)
    type          = Column(String(16), nullable=False)
    creationDate  = Column(DateTime, nullable=False)
    createdById   = Column(Integer, ForeignKey("User.id"), nullable=False)
    accessEventId = Column(Integer, ForeignKey("Event.id"), nullable=True)

    creator = orm.relationship("User")

    def __repr__(self):
        return f"<Image> [{self.id}]"

    @staticmethod
    def new(db_sess, creator, json: ImageJson):
        (data, name, accessEventId), values_error = get_json_values(json, "data", "name", ("accessEventId", None))
        if values_error:
            return None, values_error

        if accessEventId is not None and accessEventId.strip() == "":
            accessEventId = None

        data_splited = data.split(',')
        if len(data_splited) != 2:
            return None, "img data is not base64"

        img_header, img_data = data_splited
        img_header_splited  = img_header.split(";")
        if len(img_header_splited) != 2 or img_header_splited[1] != "base64":
            return None, "img data is not base64"

        img_header_splited_splited = img_header_splited[0].split(":")
        if len(img_header_splited_splited) != 2:
            return None, "img data is not base64"
        mimetype = img_header_splited_splited[1]

        if mimetype not in ["image/png", "image/jpeg", "image/gif"]:
            return "img mimetype is not in [image/png, image/jpeg, image/gif]"

        type = mimetype.split("/")[1]

        img = Image(name=name, type=type, accessEventId=accessEventId, createdById=creator.id, creationDate=get_datetime_now())
        db_sess.add(img)
        db_sess.commit()

        path = os.path.join(current_app.config["IMAGES_FOLDER"], f"{img.id}.{type}")
        with open(path, "wb") as f:
            f.write(base64.b64decode(img_data + '=='))

        return img, None
