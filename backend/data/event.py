from __future__ import annotations

from datetime import date as calendar_date
from datetime import datetime, timedelta
from typing import TYPE_CHECKING, TypedDict

from bafser import Constants, Log, ObjMixin, PublicError, SqlAlchemyBase, TruncateString, get_db_session
from sqlalchemy import Boolean, CheckConstraint, Date, Integer, orm, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from data._tables import Tables
from data.event_day import EventDayData
from data.permission_access import PermissionAccess
from data.user import User, UserData

if TYPE_CHECKING:
    from data.event_day import EventDay
    from data.ticket import Ticket
    from data.ticket_category import TicketCategory
    from data.ticket_type import TicketType


class EventDaysInUseError(PublicError):
    code = "event_days_in_use"
    status = 409


class EventData(TypedDict):
    id: int
    name: str
    date: str
    active: bool
    endDate: str
    dayCount: int
    days: list[EventDayData]


class EventListData(EventData):
    ticketCount: int


class FullEventData(EventData):
    deleted: bool
    access: list[UserData]


class Event(SqlAlchemyBase, ObjMixin):
    __tablename__ = Tables.Event
    __table_args__ = SqlAlchemyBase.extend_table_args(
        CheckConstraint("lastTicketNumber >= 0", name="event_last_ticket_number_nonnegative"),
        CheckConstraint("lastTypeNumber >= 0", name="event_last_type_number_nonnegative"),
    )

    name: Mapped[str] = mapped_column(TruncateString(64), nullable=False)
    date: Mapped[calendar_date] = mapped_column(Date, nullable=False)
    endDate: Mapped[calendar_date] = mapped_column(Date, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, server_default="1", nullable=False, default=True)
    lastTicketNumber: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False, default=0)
    lastTypeNumber: Mapped[int] = mapped_column(Integer, server_default="0", nullable=False, default=0)

    tickets: Mapped[list[Ticket]] = orm.relationship("Ticket", back_populates="event", init=False)
    ticket_types: Mapped[list[TicketType]] = orm.relationship("TicketType", back_populates="event", init=False)
    all_days: Mapped[list[EventDay]] = orm.relationship("EventDay", back_populates="event", init=False, default_factory=list)
    categories: Mapped[list[TicketCategory]] = orm.relationship("TicketCategory", back_populates="event", init=False)

    def __post_init__(self) -> None:
        self.validate_date(self.date)
        self.validate_date(self.endDate)
        if self.endDate < self.date:
            raise PublicError("Конец периода не может быть раньше начала")

    @property
    def day_count(self) -> int:
        return (self.endDate - self.date).days + 1

    @property
    def days(self) -> list[EventDay]:
        return sorted((day for day in self.all_days if day.dayOffset < self.day_count), key=lambda day: day.dayOffset)

    def ensure_days(self, day_count: int | None = None) -> list[EventDay]:
        from data.event_day import EventDay

        if self.id is not None and self.is_for_update:
            # Another period update may have committed after this transaction's
            # first consistent read. Never recreate a hidden day from a snapshot.
            from sqlalchemy.orm.attributes import set_committed_value

            current = (
                self.db_sess.execute(select(EventDay).where(EventDay.eventId == self.id).with_for_update().execution_options(populate_existing=True))
                .scalars()
                .all()
            )
            pending = [day for day in self.all_days if day in self.db_sess.new]
            set_committed_value(self, "all_days", current + pending)
        count = self.day_count if day_count is None else day_count
        existing = {day.dayOffset: day for day in self.all_days}
        for offset in range(count):
            if offset not in existing:
                day = EventDay(eventId=self.id, dayOffset=offset)
                self.all_days.append(day)
                existing[offset] = day
        return [existing[offset] for offset in range(count)]

    def __repr__(self) -> str:
        return f"<Event> [{self.id}] {self.name}"

    @staticmethod
    def new(creator: User, name: str, date: calendar_date, twoDays: bool = False, *, commit: bool = True) -> Event:
        """Create an event, grant its creator access, and commit the audit logs."""
        db_sess = creator.db_sess
        Event.validate_date(date)
        event = Event(name=name, date=date, endDate=Event.period_end(date, 2 if twoDays else 1))
        event.ensure_days()
        db_sess.add(event)
        Log.added(event, creator, commit=False)
        creator.add_access(event.id, actor=creator, commit=False)
        if commit:
            db_sess.commit()
        return event

    def _ticket_types_for_update(self, db_sess: Session) -> list[TicketType]:
        """Refresh the variant collection with a current locking read."""
        from sqlalchemy.orm.attributes import set_committed_value

        from data.ticket_type import TicketType

        variants = TicketType.query(includeDeleted=True, for_update=True, db_sess=db_sess).filter_by(eventId=self.id).all()
        set_committed_value(self, "ticket_types", variants)
        return variants

    def _on_delete(self, db_sess: Session, actor: User, now: datetime, commit: bool) -> bool:
        for ticket_type in self._ticket_types_for_update(db_sess):
            if ticket_type.deleted:
                continue
            image = ticket_type._image_for_update(db_sess)
            if image is not None and not image.deleted:
                image.delete(actor, commit=False, now=now, db_sess=db_sess)
        return True

    def _on_restore(self, db_sess: Session, actor: User, now: datetime, commit: bool) -> bool:
        """Restore live variants' images, clearing designs whose files are missing."""
        for ticket_type in self._ticket_types_for_update(db_sess):
            if ticket_type.deleted:
                continue
            image = ticket_type._image_for_update(db_sess)
            if image is not None and image.deleted:
                if not image.restore(actor, commit=False, now=now, db_sess=db_sess):
                    ticket_type.image = None
                    ticket_type.imageId = None
                    ticket_type.pattern = None
        return True

    @staticmethod
    def all_full_data() -> list[FullEventData]:
        """Batch event days and staff access for the debug event list."""
        session = get_db_session()
        events = Event.query(includeDeleted=True, db_sess=session).options(orm.selectinload(Event.all_days)).all()
        access = (
            session.query(PermissionAccess.eventId, User)
            .join(User, User.id == PermissionAccess.userId)
            .filter(User.deleted.is_(False))
            .options(*User.list_options())
            .all()
        )
        by_event = {}
        for event_id, user in access:
            by_event.setdefault(event_id, []).append(user.get_dict())
        return [{**event.get_dict(), "deleted": event.deleted, "access": by_event.get(event.id, [])} for event in events]

    @staticmethod
    def all_for_user(user: User) -> list[Event]:
        """Return non-deleted events accessible to the user."""
        db_sess = user.db_sess
        return (
            Event.query(db_sess=db_sess)
            .filter(User.access.any((PermissionAccess.eventId == Event.id) & (PermissionAccess.userId == user.id)))
            .options(orm.selectinload(Event.all_days))
            .all()
        )

    def update(
        self, actor: User, name: str, date: calendar_date, active: bool | None = None, twoDays: bool | None = None, *, commit: bool = True
    ) -> None:
        """Update event details and commit the audit log."""
        Event.validate_date(date)
        day_count = self.day_count if twoDays is None else (2 if twoDays else 1)
        end = Event.period_end(date, day_count)
        if day_count < self.day_count:
            self.require_for_update()
            from data.event_day import EventDay
            from data.ticket import Ticket
            from data.ticket_type_day import TicketTypeDay

            # Current reads, rather than a REPEATABLE READ snapshot. Shared
            # locks on immutable days remain compatible with checkin FK checks;
            # take Ticket locks before ensure_days can lock the day rows.
            type_ids = set(
                self.db_sess.execute(
                    select(TicketTypeDay.typeId)
                    .join(EventDay, EventDay.id == TicketTypeDay.eventDayId)
                    .where(EventDay.eventId == self.id, EventDay.dayOffset >= day_count)
                    .with_for_update(read=True)
                ).scalars()
            )
            used = (
                self.db_sess.execute(
                    select(Ticket.id).where(Ticket.eventId == self.id, Ticket.deleted.is_(False), Ticket.typeId.in_(type_ids)).with_for_update()
                ).first()
                if type_ids
                else None
            )
            if used is not None:
                raise EventDaysInUseError("Нельзя сократить период: выданы билеты на второй день")
        # Hidden days remain addressable by the catalog and checkin history.
        # Validate their derived dates too, before changing any event fields.
        self.ensure_days()
        if self.all_days:
            Event.period_end(date, max(day.dayOffset for day in self.all_days) + 1)
        self.name = name
        self.date = date
        self.endDate = end
        if active is not None:
            self.active = active
        changes = Log._get_obj_changes(self)
        self.ensure_days()
        Log.updated(self, actor, changes=changes, commit=commit)

    def get_dict(self) -> EventData:
        return {
            **self.to_dict(only=("id", "name", "active", "date", "endDate")),
            "dayCount": self.day_count,
            "days": [day.get_dict() for day in self.days],
        }

    @staticmethod
    def period_end(date: calendar_date, count: int) -> calendar_date:
        try:
            return date + timedelta(days=count - 1)
        except OverflowError as error:
            raise PublicError("Дни мероприятия выходят за допустимый диапазон дат") from error

    @staticmethod
    def validate_date(date: calendar_date) -> None:
        """Require a calendar date within the supported storage range."""
        if type(date) is not calendar_date or not Constants.MYSQL_DATE_MIN <= date <= Constants.MYSQL_DATE_MAX:
            raise PublicError(f"Дата должна быть от {Constants.MYSQL_DATE_MIN:%d.%m.%Y} до {Constants.MYSQL_DATE_MAX:%d.%m.%Y}")
