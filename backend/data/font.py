import os
from datetime import datetime
from typing import TypedDict

from bafser import Log, ObjMixin, SqlAlchemyBase, get_datetime_utc, track_created_file
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
    """An uploaded font resource used in ticket designs."""

    __tablename__ = Tables.Font

    name: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    type: Mapped[str] = mapped_column(String(16), nullable=False)
    creationDate: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    createdById: Mapped[int] = mapped_column(Integer, ForeignKey(f"{Tables.User}.id"), nullable=False)
    deletionDate: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)

    creator: Mapped[User] = orm.relationship("User", init=False)

    def __repr__(self) -> str:
        return f"<Font> [{self.id}]"

    @staticmethod
    def new(creator: User, name: str, type: str, file: FileStorage) -> "Font":
        """Save a font and its audit log with transaction-aware file cleanup."""
        db_sess = creator.db_sess
        now = get_datetime_utc()
        font = Font(name=name, type=type, creationDate=now, createdById=creator.id)
        db_sess.add(font)

        try:
            Log.added(font, creator, now=now, commit=False)

            path = font.get_path()
            with open(path, "xb") as target:
                track_created_file(font, path)
                file.save(target)
            db_sess.commit()
        except Exception:
            db_sess.rollback()
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

    def get_dict(self) -> FontData:
        return self.to_dict(only=("id", "name", "type"))
