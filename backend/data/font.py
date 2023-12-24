import os
from flask import current_app
from sqlalchemy import Boolean, Column, DefaultClause, String, orm, ForeignKey, Integer, DateTime
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase


class Font(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Font"

    id            = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    deleted       = Column(Boolean, DefaultClause("0"), nullable=False)
    name          = Column(String(128), nullable=False)
    type          = Column(String(16), nullable=False)
    creationDate  = Column(DateTime, nullable=False)
    deletionDate  = Column(DateTime, nullable=True)
    createdById   = Column(Integer, ForeignKey("User.id"), nullable=False)

    creator = orm.relationship("User")

    def __repr__(self):
        return f"<Font> [{self.id}]"

    def get_creation_changes(self):
        return [
            ("name", None, self.name),
            ("type", None, self.type),
            ("creationDate", None, self.creationDate.isoformat()),
            ("createdById", None, self.createdById),
        ]

    def get_path(self):
        return os.path.join(current_app.config["FONTS_FOLDER"], f"{self.id}.{self.type}")

    def get_dict(self):
        return self.to_dict(only=("id", "name"))
