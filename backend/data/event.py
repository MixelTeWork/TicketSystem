from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, TypedDict

from bafser import Log, ObjMixin, SqlAlchemyBase
from sqlalchemy import Boolean, CheckConstraint, DateTime, Integer, String, orm
from sqlalchemy.orm import Mapped, Session, mapped_column

from data._tables import Tables
from data.permission_access import PermissionAccess
from data.user import User, UserData
from utils.dates import as_utc_naive

if TYPE_CHECKING:
    from data.ticket import Ticket
    from data.ticket_type import TicketType


class EventDateError(ValueError):
    pass


class EventData(TypedDict):
    id: int
    name: str
    date: datetime
    active: bool


class EventListData(EventData):
    ticketCount: int


class FullEventData(EventData):
    deleted: bool
    access: list[UserData]


class Event(SqlAlchemyBase, ObjMixin):
    __tablename__ = Tables.Event
    # MySQL DATETIME has second precision; UTC + 3 must also fit datetime.
    DATE_MIN = datetime(1000, 1, 1)
    DATE_MAX = datetime(9999, 12, 31, 20, 59, 59)
    DATE_RANGE_ERROR = "Дата должна быть от 01.01.1000 03:00:00 до 31.12.9999 23:59:59 (МСК)"
    __table_args__ = SqlAlchemyBase.extend_table_args(
        CheckConstraint("lastTicketNumber >= 0", name="event_last_ticket_number_nonnegative"),
        CheckConstraint("lastTypeNumber >= 0", name="event_last_type_number_nonnegative"),
    )

    name: Mapped[str] = mapped_column(String(64), nullable=False)
    date: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, server_default="1", nullable=False, default=True)
    lastTicketNumber: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False, default=0)
    lastTypeNumber: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False, default=0)

    tickets: Mapped[list[Ticket]] = orm.relationship("Ticket", back_populates="event", init=False)
    ticket_types: Mapped[list[TicketType]] = orm.relationship("TicketType", back_populates="event", init=False)

    def __repr__(self) -> str:
        return f"<Event> [{self.id}] {self.name}"

    @staticmethod
    def new(creator: User, name: str, date: datetime) -> Event:
        """Create an event, grant its creator access, and commit the audit logs."""
        db_sess = Session.object_session(creator)
        event = Event(name=name, date=Event.normalize_date(date))
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
    def all_for_user(user: User) -> list[Event]:
        """Return non-deleted events accessible to the user."""
        db_sess = Session.object_session(user)
        return (
            Event.query(db_sess=db_sess).filter(User.access.any((PermissionAccess.eventId == Event.id) & (PermissionAccess.userId == user.id))).all()
        )

    def update(self, actor: User, name: str, date: datetime, active: bool | None = None) -> None:
        """Update event details and commit the audit log."""
        date = Event.normalize_date(date)
        self.name = name
        self.date = date
        if active is not None:
            self.active = active
        Log.updated(self, actor)

    def get_dict(self) -> EventData:
        return self.to_dict(only=("id", "name", "date", "active"))

    @staticmethod
    def normalize_date(date: datetime) -> datetime:
        """Normalize and validate UTC before changing the event or its audit log."""
        try:
            date = as_utc_naive(date)
        except OverflowError as error:
            raise EventDateError(Event.DATE_RANGE_ERROR) from error
        if not Event.DATE_MIN <= date <= Event.DATE_MAX:
            raise EventDateError(Event.DATE_RANGE_ERROR)
        return date

    def get_dict_full(self) -> FullEventData:
        access = User.all_with_event_access(self.id, db_sess=self.get_session())
        return {
            "id": self.id,
            "deleted": self.deleted,
            "name": self.name,
            "date": self.date,
            "active": self.active,
            "access": [v.get_dict() for v in access],
        }
