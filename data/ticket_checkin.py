from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, TypedDict

from bafser import IdMixin, SqlAlchemyBase
from sqlalchemy import DateTime, ForeignKey, Integer, UniqueConstraint, orm
from sqlalchemy.orm import Mapped, mapped_column

from data._tables import Tables

if TYPE_CHECKING:
    from data.event_day import EventDay
    from data.ticket import Ticket
    from data.user import User


class TicketCheckinData(TypedDict):
    eventDayId: int
    dayOffset: int
    dayDate: str
    checkedAt: str | None
    checkedById: int | None
    checkedBy: str | None


class TicketCheckin(SqlAlchemyBase, IdMixin):
    """A ticket's entry for one event day, preserving the original time and staff member."""

    __tablename__ = Tables.TicketCheckin
    __table_args__ = SqlAlchemyBase.extend_table_args(
        UniqueConstraint("ticketId", "eventDayId", name="uq_ticket_checkin_day"),
    )

    ticketId: Mapped[int] = mapped_column(Integer, ForeignKey(f"{Tables.Ticket}.id"), nullable=False)
    eventDayId: Mapped[int] = mapped_column(Integer, ForeignKey(f"{Tables.EventDay}.id"), nullable=False)
    checkedAt: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)
    checkedById: Mapped[int | None] = mapped_column(Integer, ForeignKey(f"{Tables.User}.id"), nullable=True, default=None)

    ticket: Mapped[Ticket] = orm.relationship("Ticket", back_populates="checkins", init=False)
    day: Mapped[EventDay] = orm.relationship("EventDay", init=False)
    checkedBy: Mapped[User | None] = orm.relationship("User", init=False)

    def get_dict(self) -> TicketCheckinData:
        result = self.to_dict(only=("eventDayId", "checkedAt", "checkedById"))
        day = self.day.to_dict(only=("dayOffset", "date"))
        return {
            **result,
            "dayOffset": day["dayOffset"],
            "dayDate": day["date"],
            "checkedBy": self.checkedBy.name if self.checkedBy is not None else None,
        }
