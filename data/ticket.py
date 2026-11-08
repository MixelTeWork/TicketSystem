from __future__ import annotations

from datetime import date as calendar_date
from datetime import datetime
from random import randint
from typing import Literal, TypedDict

from bafser import (
    Constants,
    JsonObj,
    Log,
    ObjMixin,
    PublicError,
    SqlAlchemyBase,
    TruncateString,
    get_datetime_utc,
    get_db_session,
    normalize_search,
    normalized_column,
)
from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, case, func, or_, orm, select
from sqlalchemy.orm import Mapped, Session, mapped_column
from sqlalchemy.orm.attributes import set_committed_value

from data._tables import Tables
from data.event import Event
from data.event_day import EventDay
from data.ticket_checkin import TicketCheckin, TicketCheckinData
from data.ticket_type import TicketType
from data.user import User
from utils.dates import moscow_day_utc


class TicketData(TypedDict):
    id: int
    createdDate: str
    eventId: int
    typeId: int
    type: str
    code: str
    typeDeleted: bool
    personName: str | None
    personLink: str | None
    promocode: str | None
    authOnPltf: bool
    price: int | None
    dayOffsets: list[int]
    validDates: list[str]
    checkins: list[TicketCheckinData]
    merchIssuedAt: str | None
    merchIssuedById: int | None
    merchIssuedBy: str | None


class TicketStatsData(TypedDict):
    typeId: int
    name: str
    categoryId: int
    categoryName: str
    price: int | None
    deleted: bool
    categoryDeleted: bool
    dayOffsets: list[int]
    validDates: list[str]
    count: int
    scanned: int
    authOnPltf: int
    merchIssued: int
    checkinCount: int
    byDay: list[TicketDayStatsData]


class TicketDayStatsData(TypedDict):
    eventDayId: int
    dayOffset: int
    date: str
    checkedIn: int
    eligible: int


class TicketPageTypeData(TypedDict):
    id: int
    name: str
    deleted: bool


class TicketPageData(TypedDict):
    items: list[TicketData]
    total: int
    count: int
    page: int
    pages: int
    hasAuth: bool
    types: list[TicketPageTypeData]
    promocodes: list[str]


class TicketPageJson(JsonObj):
    page: int = JsonObj.field(default=1, min_value=1)
    pageSize: int | Literal["all"] = JsonObj.field(default=25)
    search: str = JsonObj.field(default="", max_length=256)
    typeId: int | None = JsonObj.field(default=None, min_value=1, max_value=Constants.INT32_MAX)
    promocode: str | None = JsonObj.field(default=None, max_length=64)
    noPromocode: bool = JsonObj.field(default=False)
    auth: Literal["all", "yes", "no"] = JsonObj.field(default="all")
    dateFrom: str = JsonObj.field(default="")
    dateTo: str = JsonObj.field(default="")

    def date_bounds(self) -> tuple[datetime | None, datetime | None]:
        return (
            moscow_day_utc(self.dateFrom) if self.dateFrom else None,
            moscow_day_utc(self.dateTo, end_of_day=True) if self.dateTo else None,
        )

    def _validate_object(self) -> str | None:
        if isinstance(self.pageSize, int) and not 1 <= self.pageSize <= 100:
            return "pageSize must be between 1 and 100 or all"
        try:
            date_from, date_to = self.date_bounds()
        except (ValueError, OverflowError):
            return "Некорректные параметры фильтра"
        if date_from is not None and date_to is not None and date_from > date_to:
            return "Некорректные параметры фильтра"
        return None


class Ticket(SqlAlchemyBase, ObjMixin):
    """An issued ticket with its own price, daily checkins and one-time merch issuance."""

    __tablename__ = Tables.Ticket
    # TODO: validate variant quotas before exposing ticket restoration through the API.
    __table_args__ = SqlAlchemyBase.extend_table_args(
        CheckConstraint("price >= 0", name="ticket_price_nonnegative"),
    )

    createdDate: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    createdById: Mapped[int] = mapped_column(Integer, ForeignKey(f"{Tables.User}.id"), nullable=False)
    eventId: Mapped[int] = mapped_column(Integer, ForeignKey(f"{Tables.Event}.id"), nullable=False)
    typeId: Mapped[int] = mapped_column(Integer, ForeignKey(f"{Tables.TicketType}.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    updatedDate: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)
    updatedById: Mapped[int | None] = mapped_column(Integer, ForeignKey(f"{Tables.User}.id"), nullable=True, default=None)
    personName: Mapped[str | None] = mapped_column(TruncateString(256), nullable=True, default=None)
    personLink: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    promocode: Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)
    authOnPltf: Mapped[bool] = mapped_column(Boolean, server_default="0", nullable=False, default=False)
    price: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
    merchIssuedAt: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)
    merchIssuedById: Mapped[int | None] = mapped_column(Integer, ForeignKey(f"{Tables.User}.id"), nullable=True, default=None)

    person_name_search: Mapped[str | None] = normalized_column(personName)

    createdBy: Mapped[User] = orm.relationship("User", foreign_keys=[createdById], init=False)
    event: Mapped[Event] = orm.relationship("Event", back_populates="tickets", init=False)
    type: Mapped[TicketType] = orm.relationship("TicketType", init=False)
    merchIssuedBy: Mapped[User | None] = orm.relationship("User", foreign_keys=[merchIssuedById], init=False)
    checkins: Mapped[list[TicketCheckin]] = orm.relationship("TicketCheckin", back_populates="ticket", init=False, default_factory=list)

    def __repr__(self) -> str:
        return f"<Ticket> [{self.id}] {self.code}"

    @staticmethod
    def new(
        creator: User,
        ttype: TicketType,
        event: Event,
        personName: str,
        personLink: str,
        promocode: str,
        code: str,
        price: int | None = None,
    ) -> Ticket:
        """Stage a ticket and its audit log under the caller's Event lock."""
        event.require_for_update()
        if ttype.eventId != event.id or not ttype.available:
            from data.ticket_type import VariantUnavailableError

            raise VariantUnavailableError("Разновидность недоступна для выдачи")
        db_sess = creator.db_sess
        now = get_datetime_utc()
        ticket = Ticket(
            createdDate=now,
            createdById=creator.id,
            eventId=event.id,
            typeId=ttype.id,
            code=code,
            personName=personName,
            personLink=personLink,
            promocode=promocode,
            price=price,
        )

        if code:
            ticket_with_code = Ticket.get_by_code(code, includeDeleted=True, db_sess=db_sess)
            if ticket_with_code is not None:
                raise PublicError(f"Ticket with 'code={code}' already exist")
            ticket.code = code
        else:
            ticket.generate_code(event.date, event.lastTicketNumber, ttype.number)
            event.lastTicketNumber += 1
        db_sess.add(ticket)

        Log.added(ticket, creator, now=now, commit=False)
        return ticket

    @staticmethod
    def get_by_code(code: str, includeDeleted: bool = False, for_update: bool = False, *, db_sess: Session | None = None) -> Ticket | None:
        """Find a ticket by code, optionally including deleted rows or locking the row."""
        return Ticket.query(includeDeleted, for_update=for_update, db_sess=db_sess).filter(Ticket.code == code).first()

    @staticmethod
    def all_for_event(eventId: int, *, db_sess: Session | None = None) -> list[Ticket]:
        """Return non-deleted tickets for the event."""
        return Ticket.query(db_sess=db_sess).filter(Ticket.eventId == eventId).options(*Ticket.display_options()).all()

    @staticmethod
    def display_options():
        from data.ticket_type_day import TicketTypeDay

        return (
            orm.joinedload(Ticket.type).load_only(TicketType.name, TicketType.deleted),
            orm.joinedload(Ticket.type).selectinload(TicketType.days).joinedload(TicketTypeDay.day).joinedload(EventDay.event),
            orm.joinedload(Ticket.merchIssuedBy).load_only(User.name).lazyload("*"),
            orm.selectinload(Ticket.checkins).joinedload(TicketCheckin.checkedBy).load_only(User.name).lazyload("*"),
            orm.selectinload(Ticket.checkins).joinedload(TicketCheckin.day).joinedload(EventDay.event),
        )

    def load_checkins(self, *, current_read: bool = True) -> list[TicketCheckin]:
        """Load history under Ticket lock; snapshot reads require a fresh transaction."""
        query = (
            self.db_sess.query(TicketCheckin)
            .filter_by(ticketId=self.id)
            .options(orm.joinedload(TicketCheckin.day), orm.joinedload(TicketCheckin.checkedBy).load_only(User.name).lazyload("*"))
            .populate_existing()
        )
        if current_read:
            # Ticket serializes writers. Shared current reads keep joined
            # day/actor rows compatible with concurrent FK checks.
            query = query.with_for_update(read=True)
        checkins = query.all()
        set_committed_value(self, "checkins", checkins)
        return checkins

    def refresh_current_details(self, event: Event) -> None:
        """Refresh display relations under the caller's Event and Ticket locks."""
        session = self.db_sess
        if self.merchIssuedById is not None:
            actor = (
                session.query(User)
                .filter_by(id=self.merchIssuedById)
                .options(orm.load_only(User.name), orm.lazyload("*"))
                .populate_existing()
                .with_for_update(read=True)
                .one_or_none()
            )
            set_committed_value(self, "merchIssuedBy", actor)
        variant = TicketType.get(self.typeId, includeDeleted=True, for_update=True, db_sess=session)
        set_committed_value(self, "type", variant.refresh_current_relations(event))
        self.load_checkins()

    @staticmethod
    def page_for_event(eventId: int, params: TicketPageJson) -> TicketPageData:
        """Filter before counting/paging; load related display data in the same query."""
        page = params.page
        page_size = params.pageSize if isinstance(params.pageSize, int) else None
        search = params.search.strip()
        type_id = params.typeId
        promocode = params.promocode
        no_promocode = params.noPromocode
        auth = None if params.auth == "all" else params.auth == "yes"
        date_from, date_to = params.date_bounds()
        session = get_db_session()
        base = Ticket.query(db_sess=session).filter(Ticket.eventId == eventId)
        total = base.count()
        has_auth = base.with_entities(Ticket.id).filter(Ticket.authOnPltf.is_(True)).first() is not None
        types = (
            session.query(TicketType.id, TicketType.name, TicketType.deleted).filter(TicketType.eventId == eventId).order_by(TicketType.number).all()
        )
        promos = [
            row[0]
            for row in base.with_entities(Ticket.promocode)
            .filter(Ticket.promocode.isnot(None), Ticket.promocode != "")
            .distinct()
            .order_by(Ticket.promocode)
            .all()
        ]
        query = base
        if search:
            normalized_search = normalize_search(search)
            conditions = [func.lower(column).contains(search.lower(), escape="/", autoescape=True) for column in (Ticket.code, Ticket.promocode)]
            if normalized_search:
                conditions.append(Ticket.person_name_search.contains(normalized_search, escape="/", autoescape=True))
            query = query.filter(or_(*conditions))
        if promocode is not None:
            query = query.filter(func.lower(Ticket.promocode) == promocode.lower())
        if no_promocode:
            query = query.filter(or_(Ticket.promocode.is_(None), Ticket.promocode == ""))
        if type_id is not None:
            query = query.filter(Ticket.typeId == type_id)
        if auth is not None:
            query = query.filter(Ticket.authOnPltf.is_(auth))
        if date_from is not None:
            query = query.filter(Ticket.createdDate >= date_from)
        if date_to is not None:
            query = query.filter(Ticket.createdDate <= date_to)
        count = query.count()
        pages = max(1, (count + page_size - 1) // page_size) if page_size else 1
        page = max(1, min(page, pages))
        query = query.options(*Ticket.display_options()).order_by(Ticket.id.desc())
        if page_size:
            query = query.offset((page - 1) * page_size).limit(page_size)
        return {
            "items": [ticket.get_dict() for ticket in query.all()],
            "total": total,
            "count": count,
            "page": page,
            "pages": pages,
            "hasAuth": has_auth,
            "types": [{"id": id, "name": name, "deleted": deleted} for id, name, deleted in types],
            "promocodes": promos,
        }

    @staticmethod
    def counts_for_events(event_ids: list[int], *, db_sess: Session | None = None) -> dict[int, int]:
        """Count non-deleted tickets for each requested event."""
        if not event_ids:
            return {}
        rows = (
            Ticket.query(db_sess=db_sess)
            .with_entities(Ticket.eventId, func.count(Ticket.id))
            .filter(Ticket.eventId.in_(event_ids))
            .group_by(Ticket.eventId)
            .all()
        )

        return {event_id: count for event_id, count in rows}

    @staticmethod
    def stats_for_event(eventId: int, *, db_sess: Session | None = None) -> list[TicketStatsData]:
        """Aggregate ticket/checkin counts in SQL without loading issued tickets."""
        if db_sess is None:
            db_sess = get_db_session()
        from data.ticket_type_day import TicketTypeDay

        variants = (
            TicketType.query(True, db_sess=db_sess)
            .filter(TicketType.eventId == eventId)
            .options(
                orm.joinedload(TicketType.category),
                orm.joinedload(TicketType.event).selectinload(Event.all_days),
                orm.selectinload(TicketType.days).joinedload(TicketTypeDay.day),
            )
            .order_by(TicketType.number)
            .all()
        )
        checkins_per_ticket = (
            db_sess.query(TicketCheckin.ticketId, func.count(TicketCheckin.id).label("total"))
            .join(Ticket, Ticket.id == TicketCheckin.ticketId)
            .filter(Ticket.eventId == eventId, Ticket.deleted.is_(False))
            .group_by(TicketCheckin.ticketId)
            .subquery()
        )
        counts = (
            Ticket.query(db_sess=db_sess)
            .with_entities(
                Ticket.typeId,
                func.count(Ticket.id),
                func.sum(case((checkins_per_ticket.c.total > 0, 1), else_=0)),
                func.sum(case((Ticket.authOnPltf.is_(True), 1), else_=0)),
                func.sum(case((Ticket.merchIssuedAt.isnot(None), 1), else_=0)),
                func.sum(func.coalesce(checkins_per_ticket.c.total, 0)),
            )
            .outerjoin(checkins_per_ticket, checkins_per_ticket.c.ticketId == Ticket.id)
            .filter(Ticket.eventId == eventId)
            .group_by(Ticket.typeId)
            .all()
        )
        totals = {
            type_id: {"count": int(count), "scanned": int(scanned), "authOnPltf": int(auth), "merchIssued": int(merch), "checkinCount": int(checkins)}
            for type_id, count, scanned, auth, merch, checkins in counts
        }
        daily = (
            db_sess.query(Ticket.typeId, EventDay, func.count(TicketCheckin.id))
            .select_from(Ticket)
            .join(TicketCheckin, TicketCheckin.ticketId == Ticket.id)
            .join(EventDay, EventDay.id == TicketCheckin.eventDayId)
            .filter(Ticket.eventId == eventId, Ticket.deleted.is_(False))
            .group_by(Ticket.typeId, EventDay.id, EventDay.eventId, EventDay.dayOffset)
            .all()
        )
        by_day = {}
        for type_id, day, count in daily:
            by_day.setdefault(type_id, {})[day.id] = (day, count)
        result = []
        for variant in variants:
            total = totals.get(variant.id, {"count": 0, "scanned": 0, "authOnPltf": 0, "merchIssued": 0, "checkinCount": 0})
            if not total["count"] and not variant.available:
                continue
            checked_days = by_day.get(variant.id, {})
            days = {day.id: day for day in variant.event.days}
            days.update({link.day.id: link.day for link in variant.days})
            days.update({day_id: day for day_id, (day, _) in checked_days.items()})
            result.append(
                {
                    "typeId": variant.id,
                    "name": variant.name,
                    "categoryId": variant.categoryId,
                    "categoryName": variant.category.name,
                    "price": variant.price,
                    "deleted": variant.deleted,
                    "categoryDeleted": variant.category.deleted,
                    "dayOffsets": variant.day_offsets,
                    "validDates": variant.valid_dates,
                    **total,
                    "byDay": [
                        {
                            "eventDayId": day.id,
                            **day.to_dict(only=("dayOffset", "date")),
                            "checkedIn": int(checked_days[day.id][1]) if day.id in checked_days else 0,
                            "eligible": total["count"] if day.dayOffset in variant.day_offsets else 0,
                        }
                        for day in sorted(days.values(), key=lambda day: day.dayOffset)
                    ],
                }
            )
        return result

    @staticmethod
    def count_for_type_locked(event: Event, ttype: TicketType) -> int:
        event.require_for_update()
        if ttype.eventId != event.id:
            raise ValueError("Разновидность другого мероприятия")
        return len(
            event.db_sess.execute(
                select(Ticket.id).where(Ticket.eventId == event.id, Ticket.typeId == ttype.id, Ticket.deleted.is_(False)).with_for_update()
            ).all()
        )

    def record_checkin(self, actor: User, day: EventDay, *, now: datetime, commit: bool = False) -> TicketCheckin:
        self.require_for_update()
        if actor is None or now is None:
            raise ValueError("Новый проход требует времени и сотрудника")
        if day.eventId != self.eventId:
            raise ValueError("День другого мероприятия")
        checkin = TicketCheckin(ticketId=self.id, eventDayId=day.id, checkedAt=now, checkedById=actor.id)
        checkin.day = day
        checkin.checkedBy = actor
        self.checkins.append(checkin)
        Log.added(checkin, actor, now=now, commit=commit, db_sess=self.db_sess)
        return checkin

    def record_merch_issue(self, actor: User, *, now: datetime, commit: bool = False) -> None:
        self.require_for_update()
        if self.merchIssuedAt is not None:
            raise ValueError("Мерч уже выдан")
        self.merchIssuedAt = now
        self.merchIssuedBy = actor
        self.merchIssuedById = actor.id
        Log.updated(self, actor, now=now, commit=commit)

    def _on_restore(self, db_sess: Session, actor: User, now: datetime, commit: bool) -> bool:
        event = Event.get(self.eventId, includeDeleted=True, for_update=True, db_sess=db_sess)
        # TODO: validate variant quotas before exposing restoration through API.
        return event is not None and self.type.days_fit_period

    def generate_code(self, eventDate: calendar_date, last_ticket_number: int, type_number: int) -> None:
        """Assign a code using the event date, type number and next ticket number."""
        date = str(eventDate.year)[-1] + f"{eventDate.month:02d}{eventDate.day:02d}"
        self.code = f"{self.eventId:03d}-{date}-{randint(0, 99):02d}-{type_number:02d}-{last_ticket_number + 1:04d}"

    def update(self, actor: User, typeId: int, personName: str, personLink: str, promocode: str, price: int | None = None) -> None:
        """Stage ticket details and their audit log in the caller's transaction."""
        now = get_datetime_utc()

        self.updatedDate = now
        self.updatedById = actor.id
        if typeId != self.typeId:
            new_type = TicketType.get(typeId, db_sess=self.db_sess)
            if new_type is None or new_type.eventId != self.eventId or not new_type.available:
                from data.ticket_type import VariantUnavailableError

                raise VariantUnavailableError("Разновидность недоступна для перевода")
            self.type = new_type
            self.typeId = typeId
        self.personName = personName
        self.personLink = personLink
        self.promocode = promocode
        self.price = price

        Log.updated(self, actor, now=now, commit=False)

    def get_dict(self) -> TicketData:
        res = self.to_dict(
            only=(
                "id",
                "createdDate",
                "eventId",
                "typeId",
                "code",
                "personName",
                "personLink",
                "promocode",
                "authOnPltf",
                "price",
                "merchIssuedAt",
                "merchIssuedById",
            )
        )
        res["type"] = self.type.name
        res["typeDeleted"] = self.type.deleted
        res["dayOffsets"] = self.type.day_offsets
        res["validDates"] = self.type.valid_dates
        res["checkins"] = [checkin.get_dict() for checkin in sorted(self.checkins, key=lambda checkin: checkin.day.dayOffset)]
        res["merchIssuedBy"] = self.merchIssuedBy.name if self.merchIssuedBy else None
        return res
