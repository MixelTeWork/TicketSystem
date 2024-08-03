import os
from flask import current_app
from werkzeug.datastructures import FileStorage
from sqlalchemy import Boolean, Column, DefaultClause, String, orm, ForeignKey, Integer, DateTime
from sqlalchemy.orm import Session
from sqlalchemy_serializer import SerializerMixin

from data.get_datetime_now import get_datetime_now
from data.log import Actions, Log, Tables
from data.user import User
from .db_session import SqlAlchemyBase


class Font(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Font"

    id            = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    deleted       = Column(Boolean, DefaultClause("0"), nullable=False)
    name          = Column(String(128), nullable=False, unique=True)
    type          = Column(String(16), nullable=False)
    creationDate  = Column(DateTime, nullable=False)
    deletionDate  = Column(DateTime, nullable=True)
    createdById   = Column(Integer, ForeignKey("User.id"), nullable=False)

    creator = orm.relationship("User")

    def __repr__(self):
        return f"<Font> [{self.id}]"

    @staticmethod
    def new(creator: User, name: str, type: str, file: FileStorage):
        db_sess = Session.object_session(creator)
        now = get_datetime_now()
        font = Font(name=name, type=type, creationDate=now, createdById=creator.id)
        db_sess.add(font)

        log = Log(
            date=now,
            actionCode=Actions.added,
            userId=creator.id,
            userName=creator.name,
            tableName=Tables.Font,
            recordId=-1,
            changes=[
                ("name", None, font.name),
                ("type", None, font.type),
                ("creationDate", None, font.creationDate.isoformat()),
                ("createdById", None, font.createdById),
            ]
        )
        db_sess.add(log)
        db_sess.commit()

        path = font.get_path()
        file.save(path)
        log.recordId = font.id
        db_sess.commit()

        return font

    @staticmethod
    def get(db_sess: Session, id: int, includeDeleted=False):
        font = db_sess.get(Font, id)
        if font is None or (not includeDeleted and font.deleted):
            return None
        return font

    def get_path(self):
        return os.path.join(current_app.config["FONTS_FOLDER"], f"{self.id}.{self.type}")

    def get_filename(self):
        return self.name + "." + self.type

    def get_dict(self):
        return self.to_dict(only=("id", "name", "type"))
