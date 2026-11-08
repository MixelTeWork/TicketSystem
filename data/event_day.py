from __future__ import annotations

from datetime import date, timedelta
from typing import TYPE_CHECKING, TypedDict

from bafser import IdMixin, SqlAlchemyBase
from sqlalchemy import CheckConstraint, ForeignKey, Integer, UniqueConstraint, inspect, orm
from sqlalchemy.orm import Mapped, mapped_column, validates

from data._tables import Tables

if TYPE_CHECKING:
    from data.event import Event


class EventDayData(TypedDict):
    id: int
    dayOffset: int
    date: str


class EventDay(SqlAlchemyBase, IdMixin):
    """A stable event day identified by its immutable offset from the event's start."""

    __tablename__ = Tables.EventDay
    __table_args__ = SqlAlchemyBase.extend_table_args(
        UniqueConstraint("eventId", "dayOffset", name="uq_event_day_offset"),
        CheckConstraint("dayOffset >= 0", name="event_day_offset_nonnegative"),
    )

    eventId: Mapped[int] = mapped_column(Integer, ForeignKey(f"{Tables.Event}.id"), nullable=False)
    dayOffset: Mapped[int] = mapped_column(Integer, nullable=False)

    event: Mapped[Event] = orm.relationship("Event", back_populates="all_days", init=False)

    @validates("dayOffset", "eventId")
    def _immutable(self, key: str, value: int):
        state = inspect(self)
        if state.persistent or state.detached:
            previous = getattr(self, key)
            if previous != value:
                raise ValueError("Смещение и мероприятие дня неизменяемы")
        if key == "dayOffset" and (type(value) is not int or value < 0):
            raise ValueError("Некорректное смещение дня")
        return value

    @property
    def date(self) -> date:
        return self.event.date + timedelta(days=self.dayOffset)

    def get_dict(self) -> EventDayData:
        return self.to_dict(only=("id", "dayOffset", "date"))
