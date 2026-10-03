from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from bafser import Log, ObjMixin, SqlAlchemyBase
from sqlalchemy import Boolean, DateTime, Integer, String, orm
from sqlalchemy.orm import Mapped, Session, mapped_column

from data._tables import Tables
from data.permission_access import PermissionAccess
from data.user import User

if TYPE_CHECKING:
    from data.ticket import Ticket
    from data.ticket_type import TicketType


class Event(SqlAlchemyBase, ObjMixin):
    __tablename__ = Tables.Event

    name: Mapped[str] = mapped_column(String(64), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, server_default="1", nullable=False, default=True)
    lastTicketNumber: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False, default=0)
    lastTypeNumber: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False, default=0)

    tickets: Mapped[list[Ticket]] = orm.relationship("Ticket", back_populates="event", init=False)
    ticket_types: Mapped[list[TicketType]] = orm.relationship("TicketType", back_populates="event", init=False)

    def __repr__(self):
        return f"<Event> [{self.id}] {self.name}"

    @staticmethod
    def new(creator: User, name: str, date: datetime):
        db_sess = Session.object_session(creator)
        event = Event(name=name, date=date)
        db_sess.add(event)

        Log.added(event, creator)
        creator.add_access(event.id, actor=creator)
        return event

    @staticmethod
    def all_for_user(user: User):
        db_sess = Session.object_session(user)
        return Event.query(db_sess).filter(User.access.any((PermissionAccess.eventId == Event.id) & (PermissionAccess.userId == user.id))).all()

    def get_dict(self):
        return self.to_dict(only=("id", "name", "date"))

    def get_dict_full(self):
        db_sess = Session.object_session(self)
        access = User.all_event_access(db_sess, self.id)
        return {
            "id": self.id,
            "deleted": self.deleted,
            "name": self.name,
            "date": self.date,
            "active": self.active,
            "access": [v.get_dict() for v in access],
        }
