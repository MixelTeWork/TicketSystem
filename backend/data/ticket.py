from __future__ import annotations

from datetime import datetime
from random import randint
from typing import Literal, TypedDict

from bafser import JsonObj, Log, ObjMixin, SqlAlchemyBase, TruncateString, get_datetime_utc, get_db_session, normalize_search, normalized_column
from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, case, func, or_, orm
from sqlalchemy.orm import Mapped, Session, mapped_column

from data._tables import Tables
from data.event import Event
from data.ticket_type import TicketType
from data.user import User
from utils.dates import as_moscow, moscow_day_utc


class TicketData(TypedDict):
    id: int
    createdDate: datetime
    eventId: int
    typeId: int
    type: str
    code: str
    scanned: bool
    scannedById: int | None
    scannedBy: str | None
    scannedDate: datetime | None
    personName: str | None
    personLink: str | None
    promocode: str | None
    authOnPltf: bool
    price: int | None


class TicketStatsData(TypedDict):
    typeId: int
    count: int
    scanned: int
    authOnPltf: int


class TicketPageTypeData(TypedDict):
    id: int
    name: str


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
    typeId: int | None = JsonObj.field(default=None, min_value=1, max_value=2_147_483_647)
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
    __tablename__ = Tables.Ticket
    # TODO: validate variant quotas before exposing ticket restoration through the API.
    __table_args__ = SqlAlchemyBase.extend_table_args(
        CheckConstraint("price >= 0", name="ticket_price_nonnegative"),
    )

    createdDate: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    createdById: Mapped[int] = mapped_column(Integer, ForeignKey("User.id"), nullable=False)
    eventId: Mapped[int] = mapped_column(Integer, ForeignKey("Event.id"), nullable=False)
    typeId: Mapped[int] = mapped_column(Integer, ForeignKey("TicketType.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    scanned: Mapped[bool] = mapped_column(Boolean, server_default="0", nullable=False, default=False)
    updatedDate: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)
    updatedById: Mapped[int | None] = mapped_column(Integer, ForeignKey("User.id"), nullable=True, default=None)
    scannedDate: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)
    scannedById: Mapped[int | None] = mapped_column(Integer, ForeignKey("User.id"), nullable=True, default=None)
    personName: Mapped[str | None] = mapped_column(TruncateString(256), nullable=True, default=None)
    personLink: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    promocode: Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)
    authOnPltf: Mapped[bool] = mapped_column(Boolean, server_default="0", nullable=False, default=False)
    price: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)

    person_name_search: Mapped[str | None] = normalized_column(personName)

    createdBy: Mapped[User] = orm.relationship("User", foreign_keys=[createdById], init=False)
    event: Mapped[Event] = orm.relationship("Event", back_populates="tickets", init=False)
    type: Mapped[TicketType] = orm.relationship("TicketType", init=False)
    scannedBy: Mapped[User | None] = orm.relationship("User", foreign_keys=[scannedById], init=False)

    def __repr__(self) -> str:
        return f"<Ticket> [{self.id}] {self.code}"

    @staticmethod
    def new(
        creator: User, ttype: TicketType, event: Event, personName: str, personLink: str, promocode: str, code: str, price: int | None = None
    ) -> tuple[Ticket, None] | tuple[None, str]:
        """Create and commit a ticket, or return a duplicate-code error; lock the event first."""
        event.require_for_update()
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
                return None, f"Ticket with 'code={code}' already exist"
            ticket.code = code
        else:
            ticket.generate_code(event.date, event.lastTicketNumber, ttype.number)
            event.lastTicketNumber += 1
        db_sess.add(ticket)

        Log.added(ticket, creator, now=now)
        return ticket, None

    @staticmethod
    def get_by_code(code: str, includeDeleted: bool = False, for_update: bool = False, *, db_sess: Session | None = None) -> Ticket | None:
        """Find a ticket by code, optionally including deleted rows or locking the row."""
        return Ticket.query(includeDeleted, for_update=for_update, db_sess=db_sess).filter(Ticket.code == code).first()

    @staticmethod
    def all_for_event(eventId: int, *, db_sess: Session | None = None) -> list[Ticket]:
        """Return non-deleted tickets for the event."""
        return Ticket.query(db_sess=db_sess).filter(Ticket.eventId == eventId).all()

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
        has_auth = base.filter(Ticket.authOnPltf.is_(True)).first() is not None
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
            conditions = [
                func.lower(column).contains(search.lower(), escape="/", autoescape=True)
                for column in (Ticket.code, Ticket.promocode)
            ]
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
        query = query.options(orm.joinedload(Ticket.type), orm.joinedload(Ticket.scannedBy)).order_by(Ticket.id.desc())
        if page_size:
            query = query.offset((page - 1) * page_size).limit(page_size)
        return {
            "items": [ticket.get_dict() for ticket in query.all()],
            "total": total,
            "count": count,
            "page": page,
            "pages": pages,
            "hasAuth": has_auth,
            "types": [{"id": id, "name": f"<Удалён> {name}" if deleted else name} for id, name, deleted in types],
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
        """Count non-deleted tickets, scans and platform logins by ticket type."""
        if db_sess is None:
            db_sess = get_db_session()
        rows = (
            db_sess.query(
                Ticket.typeId,
                func.count(Ticket.id),
                func.sum(case((Ticket.scanned, 1), else_=0)),
                func.sum(case((Ticket.authOnPltf, 1), else_=0)),
            )
            .filter(Ticket.deleted.is_(False), Ticket.eventId == eventId)
            .group_by(Ticket.typeId)
            .all()
        )
        return [
            {
                "typeId": type_id,
                "count": count,
                "scanned": int(scanned),
                "authOnPltf": int(auth),
            }
            for type_id, count, scanned, auth in rows
        ]

    def mark_scanned(self, actor: User | None = None) -> None:
        """Mark a validated, locked ticket as scanned and commit its audit log."""
        self.require_for_update()
        self.scanned = True
        self.scannedDate = get_datetime_utc()
        self.scannedById = actor.id if actor is not None else None
        Log.updated(self, actor, now=self.scannedDate)

    def generate_code(self, eventDate: datetime, last_ticket_number: int, type_number: int) -> None:
        """Assign a code using the event date, type number and next ticket number."""
        eventDate = as_moscow(eventDate)
        date = str(eventDate.year)[-1] + f"{eventDate.month:02d}{eventDate.day:02d}"
        self.code = f"{self.eventId:03d}-{date}-{randint(0, 99):02d}-{type_number:02d}-{last_ticket_number + 1:04d}"

    def update(self, actor: User, typeId: int, personName: str, personLink: str, promocode: str, price: int | None = None) -> None:
        """Update ticket details and commit the audit log with actor and timestamp."""
        now = get_datetime_utc()

        self.updatedDate = now
        self.updatedById = actor.id
        self.typeId = typeId
        self.personName = personName
        self.personLink = personLink
        self.promocode = promocode
        self.price = price

        Log.updated(self, actor, now=now)

    def get_dict(self) -> TicketData:
        res = self.to_dict(
            only=(
                "id",
                "createdDate",
                "eventId",
                "typeId",
                "code",
                "scanned",
                "scannedById",
                "scannedDate",
                "personName",
                "personLink",
                "promocode",
                "authOnPltf",
                "price",
            )
        )
        res["type"] = self.type.name
        if self.type.deleted:
            res["type"] = "<Удалён>" + res["type"]
        res["scannedBy"] = self.scannedBy.name if self.scannedBy is not None else None
        return res
