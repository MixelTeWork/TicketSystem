import base64
import os
from typing import TypedDict
from flask import current_app
from sqlalchemy import Boolean, Column, DefaultClause, String, orm, ForeignKey, Integer, DateTime
from sqlalchemy_serializer import SerializerMixin
from data.log import Actions, Log, Tables

from utils import get_datetime_now, get_json_values
from .db_session import SqlAlchemyBase


class ImageJson(TypedDict):
    data: str
    name: str
    accessEventId: int


class Image(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Image"

    id            = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    deleted       = Column(Boolean, DefaultClause("0"), nullable=False)
    name          = Column(String(128), nullable=False)
    type          = Column(String(16), nullable=False)
    creationDate  = Column(DateTime, nullable=False)
    deletionDate  = Column(DateTime, nullable=True)
    createdById   = Column(Integer, ForeignKey("User.id"), nullable=False)
    accessEventId = Column(Integer, ForeignKey("Event.id"), nullable=True)

    creator = orm.relationship("User")

    def __repr__(self):
        return f"<Image> [{self.id}]"

    def get_creation_changes(self):
        return [
            ("name", None, self.name),
            ("type", None, self.type),
            ("creationDate", None, self.creationDate.isoformat()),
            ("createdById", None, self.createdById),
            ("accessEventId", None, self.accessEventId),
        ]

    def get_path(self):
        return os.path.join(current_app.config["IMAGES_FOLDER"], f"{self.id}.{self.type}")

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
            return None, "img mimetype is not in [image/png, image/jpeg, image/gif]"

        type = mimetype.split("/")[1]

        img = Image(name=name, type=type, accessEventId=accessEventId, createdById=creator.id, creationDate=get_datetime_now())
        db_sess.add(img)
        db_sess.commit()

        path = img.get_path()
        with open(path, "wb") as f:
            f.write(base64.b64decode(img_data + '=='))

        db_sess.add(Log(
            date=get_datetime_now(),
            actionCode=Actions.added,
            userId=creator.id,
            userName=creator.name,
            tableName=Tables.Image,
            recordId=img.id,
            changes=img.get_creation_changes()
        ))
        db_sess.commit()

        return img, None

    def delete(self, db_sess, user):
        now = get_datetime_now()
        self.deleted = True
        self.deletionDate = now
        db_sess.add(Log(
            date=now,
            actionCode=Actions.deleted,
            userId=user.id,
            userName=user.name,
            tableName=Tables.Image,
            recordId=self.id,
            changes=[]
        ))
        db_sess.commit()

    def restore(self, db_sess, user):
        path = self.get_path()
        if not os.path.exists(path):
            return False

        self.deleted = False
        db_sess.add(Log(
            date=get_datetime_now(),
            actionCode=Actions.restored,
            userId=user.id,
            userName=user.name,
            tableName=Tables.Image,
            recordId=self.id,
            changes=[]
        ))
        db_sess.commit()

        return True
