from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, TypedDict

from bafser import Log, ObjMixin, SqlAlchemyBase
from sqlalchemy import Boolean, DateTime, Integer, String, orm
from sqlalchemy.orm import Mapped, Session, mapped_column

from data._tables import Tables
from data.permission_access import PermissionAccess
from data.user import User

if TYPE_CHECKING:
    from data.ticket import Ticket
    from data.ticket_type import TicketType


class AccessData(TypedDict):
    userId: int
    eventId: int


class EventData(TypedDict):
    id: int
    name: str
    date: datetime


class FullEventData(EventData):
    deleted: bool
    active: bool
    access: list[AccessData]


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
        Log.added(event, creator, commit=False)
        creator.add_access(event.id, actor=creator, commit=False)
        db_sess.commit()
        return event

    def _on_delete(self, db_sess: Session, actor: User, now: datetime, commit: bool) -> bool:
        for ticket_type in self.ticket_types:
            image = ticket_type.image
            if not ticket_type.deleted and image is not None and not image.deleted:
                image.delete(actor, commit=False, now=now, db_sess=db_sess)
        return True

    @staticmethod
    def all_for_user(user: User):
        db_sess = Session.object_session(user)
        return Event.query(db_sess=db_sess).filter(User.access.any((PermissionAccess.eventId == Event.id) & (PermissionAccess.userId == user.id))).all()

    def get_dict(self):
        return self.to_dict(only=("id", "name", "date"))

    def get_dict_full(self):
        access = User.all_event_access(self.id, db_sess=self.get_session())
        return {
            "id": self.id,
            "deleted": self.deleted,
            "name": self.name,
            "date": self.date,
            "active": self.active,
            "access": [v.get_dict() for v in access],
        }
