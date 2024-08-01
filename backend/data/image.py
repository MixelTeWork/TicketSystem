import base64
import os
from typing import TypedDict
from flask import current_app
from sqlalchemy import Boolean, Column, DefaultClause, String, orm, ForeignKey, Integer, DateTime
from sqlalchemy.orm import Session
from sqlalchemy_serializer import SerializerMixin
from data.log import Actions, Log, Tables

from data.user import User
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

    @staticmethod
    def new(creator: User, json: ImageJson):
        (data, name, accessEventId), values_error = get_json_values(json, "data", "name", ("accessEventId", None))
        if values_error:
            return None, values_error

        data_splited = data.split(',')
        if len(data_splited) != 2:
            return None, "img data is not base64"

        img_header, img_data = data_splited
        img_header_splited = img_header.split(";")
        if len(img_header_splited) != 2 or img_header_splited[1] != "base64":
            return None, "img data is not base64"

        img_header_splited_splited = img_header_splited[0].split(":")
        if len(img_header_splited_splited) != 2:
            return None, "img data is not base64"
        mimetype = img_header_splited_splited[1]

        if mimetype not in ["image/png", "image/jpeg", "image/gif"]:
            return None, "img mimetype is not in [image/png, image/jpeg, image/gif]"

        type = mimetype.split("/")[1]

        db_sess = Session.object_session(creator)
        now = get_datetime_now()
        img = Image(name=name, type=type, accessEventId=accessEventId, createdById=creator.id, creationDate=now)
        db_sess.add(img)
        db_sess.commit()

        path = img.get_path()
        with open(path, "wb") as f:
            f.write(base64.b64decode(img_data + '=='))

        db_sess.add(Log(
            date=now,
            actionCode=Actions.added,
            userId=creator.id,
            userName=creator.name,
            tableName=Tables.Image,
            recordId=img.id,
            changes=[
                ("name", None, img.name),
                ("type", None, img.type),
                ("creationDate", None, img.creationDate.isoformat()),
                ("createdById", None, img.createdById),
                ("accessEventId", None, img.accessEventId),
            ]
        ))
        db_sess.commit()

        return img, None

    @staticmethod
    def get(db_sess: Session, id: int, includeDeleted=False):
        img = db_sess.get(Image, id)
        if img is None or (not includeDeleted and img.deleted):
            return None
        return img

    def delete(self, user: User, commit=True):
        db_sess = Session.object_session(self)

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
        if commit:
            db_sess.commit()

    def restore(self, user: User):
        db_sess = Session.object_session(self)

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

    def get_path(self):
        return os.path.join(current_app.config["IMAGES_FOLDER"], f"{self.id}.{self.type}")

    def get_filename(self):
        return self.name + "." + self.type
