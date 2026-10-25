import os
from datetime import datetime
from typing import TypedDict

from bafser import Log, ObjMixin, SqlAlchemyBase, get_datetime_utc
from flask import current_app
from sqlalchemy import DateTime, ForeignKey, Integer, String, orm
from sqlalchemy.orm import Mapped, Session, mapped_column
from werkzeug.datastructures import FileStorage

from data._tables import Tables
from data.user import User


class FontData(TypedDict):
    id: int
    name: str
    type: str


class Font(SqlAlchemyBase, ObjMixin):
    __tablename__ = Tables.Font

    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    creationDate: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    createdById: Mapped[int] = mapped_column(Integer, ForeignKey("User.id"), nullable=False)
    deletionDate: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)

    creator: Mapped[User] = orm.relationship("User", init=False)

    def __repr__(self) -> str:
        return f"<Font> [{self.id}]"

    @staticmethod
    def new(creator: User, name: str, type: str, file: FileStorage):
        """Save a font and commit its audit log; remove the file on failure."""
        db_sess = Session.object_session(creator)
        now = get_datetime_utc()
        font = Font(name=name, type=type, creationDate=now, createdById=creator.id)
        db_sess.add(font)

        path = None
        try:
            Log.added(font, creator, now=now, commit=False)

            path = font.get_path()
            file.save(path)
            db_sess.commit()
        except Exception:
            db_sess.rollback()
            if path is not None and os.path.exists(path):
                os.remove(path)
            raise
        return font

    def _on_restore(self, db_sess: Session, actor: User, now: datetime, commit: bool) -> bool:
        return os.path.exists(self.get_path())

    def get_path(self) -> str:
        """Return the storage path of the font file."""
        return os.path.join(current_app.config["FONTS_FOLDER"], f"{self.id}.{self.type}")

    def get_filename(self) -> str:
        """Return the font name with its file extension."""
        return self.name + "." + self.type

    def get_dict(self):
        return self.to_dict(only=("id", "name", "type"))
