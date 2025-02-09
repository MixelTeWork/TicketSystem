import os

from flask import current_app
from werkzeug.datastructures import FileStorage
from sqlalchemy import Column, String, orm, ForeignKey, Integer, DateTime
from sqlalchemy.orm import Session

from bfs import SqlAlchemyBase, ObjMixin, get_datetime_now, Log
from data._tables import Tables
from data.user import User


class Font(SqlAlchemyBase, ObjMixin):
    __tablename__ = Tables.Font

    name = Column(String(128), nullable=False, unique=True)
    type = Column(String(16), nullable=False)
    creationDate = Column(DateTime, nullable=False)
    deletionDate = Column(DateTime, nullable=True)
    createdById = Column(Integer, ForeignKey("User.id"), nullable=False)

    creator = orm.relationship("User")

    def __repr__(self):
        return f"<Font> [{self.id}]"

    @staticmethod
    def new(creator: User, name: str, type: str, file: FileStorage):
        db_sess = Session.object_session(creator)
        now = get_datetime_now()
        font = Font(name=name, type=type, creationDate=now, createdById=creator.id)
        db_sess.add(font)

        Log.added(font, creator, Tables.Font, [
            ("name", font.name),
            ("type", font.type),
            ("creationDate", font.creationDate.isoformat()),
            ("createdById", font.createdById),
        ], now=now)

        file.save(font.get_path())
        return font

    def restore(self, actor: User):
        if not os.path.exists(self.get_path()):
            return False
        super().restore(actor)
        return True

    def get_path(self):
        return os.path.join(current_app.config["FONTS_FOLDER"], f"{self.id}.{self.type}")

    def get_filename(self):
        return self.name + "." + self.type

    def get_dict(self):
        return self.to_dict(only=("id", "name", "type"))
