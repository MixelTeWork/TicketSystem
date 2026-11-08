from __future__ import annotations

from typing import TYPE_CHECKING

from bafser import IdMixin, SqlAlchemyBase
from sqlalchemy import ForeignKey, Integer, UniqueConstraint, inspect, orm
from sqlalchemy.orm import Mapped, mapped_column, validates

from data._tables import Tables

if TYPE_CHECKING:
    from data.event_day import EventDay
    from data.ticket_type import TicketType


class TicketTypeDay(SqlAlchemyBase, IdMixin):
    """An immutable link between a ticket variant and an event day."""

    __tablename__ = Tables.TicketTypeDay
    __table_args__ = SqlAlchemyBase.extend_table_args(
        UniqueConstraint("typeId", "eventDayId", name="uq_ticket_type_day"),
    )

    typeId: Mapped[int] = mapped_column(Integer, ForeignKey(f"{Tables.TicketType}.id"), nullable=False)
    eventDayId: Mapped[int] = mapped_column(Integer, ForeignKey(f"{Tables.EventDay}.id"), nullable=False)

    type: Mapped[TicketType] = orm.relationship("TicketType", back_populates="days", init=False)
    day: Mapped[EventDay] = orm.relationship("EventDay", init=False)

    @validates("typeId", "eventDayId")
    def _immutable(self, key: str, value: int):
        state = inspect(self)
        if state.persistent or state.detached:
            previous = getattr(self, key)
            if previous != value:
                raise ValueError("Набор дней разновидности неизменяем")
        return value
