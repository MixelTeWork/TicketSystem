from __future__ import annotations

from datetime import datetime
from random import randint
from typing import TypedDict

from bafser import Log, ObjMixin, SqlAlchemyBase, get_datetime_now, get_db_session
from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, String, case, func, orm
from sqlalchemy.orm import Mapped, Session, mapped_column

from data._tables import Tables
from data.event import Event
from data.ticket_type import TicketType
from data.user import User


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


class Ticket(SqlAlchemyBase, ObjMixin):
    __tablename__ = Tables.Ticket
    __table_args__ = SqlAlchemyBase.extend_table_args(
        CheckConstraint("price >= 0", name="ticket_price_nonnegative"),
    )

    createdDate: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    createdById: Mapped[int] = mapped_column(Integer, ForeignKey("User.id"), nullable=False)
    eventId: Mapped[int] = mapped_column(Integer, ForeignKey("Event.id"), nullable=False)
    typeId: Mapped[int] = mapped_column(Integer, ForeignKey("TicketType.id"), nullable=False)
    code: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=False, default=None)
    scanned: Mapped[bool] = mapped_column(Boolean, server_default="0", nullable=False, default=False)
    updatedDate: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)
    updatedById: Mapped[int | None] = mapped_column(Integer, ForeignKey("User.id"), nullable=True, default=None)
    scannedDate: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, default=None)
    scannedById: Mapped[int | None] = mapped_column(Integer, ForeignKey("User.id"), nullable=True, default=None)
    personName: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    personLink: Mapped[str | None] = mapped_column(String(256), nullable=True, default=None)
    promocode: Mapped[str | None] = mapped_column(String(64), nullable=True, default=None)
    authOnPltf: Mapped[bool] = mapped_column(Boolean, server_default="0", nullable=False, default=False)
    price: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)

    createdBy: Mapped[User] = orm.relationship("User", foreign_keys=[createdById], init=False)
    event: Mapped[Event] = orm.relationship("Event", back_populates="tickets", init=False)
    type: Mapped[TicketType] = orm.relationship("TicketType", init=False)
    scannedBy: Mapped[User | None] = orm.relationship("User", foreign_keys=[scannedById], init=False)

    def __repr__(self) -> str:
        return f"<Ticket> [{self.id}] {self.code}"

    @staticmethod
    def new(
        creator: User, ttype: TicketType, event: Event, personName: str, personLink: str, promocode: str, code: str, price: int | None = None
    ) -> tuple[Ticket | None, str | None]:
        """Create and commit a ticket, or return a duplicate-code error; lock the event first."""
        db_sess = Session.object_session(creator)
        now = get_datetime_now()
        ticket = Ticket(
            createdDate=now,
            createdById=creator.id,
            eventId=event.id,
            typeId=ttype.id,
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

    def mark_scanned(self) -> None:
        """Mark a validated, locked ticket as scanned and commit its audit log."""
        self.scanned = True
        self.scannedDate = get_datetime_now()
        Log.updated(self, now=self.scannedDate)

    def generate_code(self, eventDate: datetime, last_ticket_number: int, type_number: int) -> None:
        """Assign a code using the event date, type number and next ticket number."""
        date = str(eventDate.year)[-1] + f"{eventDate.month:02d}{eventDate.day:02d}"
        self.code = f"{self.eventId:03d}-{date}-{randint(0, 99):02d}-{type_number:02d}-{last_ticket_number + 1:04d}"

    def update(self, actor: User, typeId: int, personName: str, personLink: str, promocode: str, price: int | None = None):
        """Update ticket details and commit the audit log with actor and timestamp."""
        now = get_datetime_now()

        self.updatedDate = now
        self.updatedById = actor.id
        self.typeId = typeId
        self.personName = personName
        self.personLink = personLink
        self.promocode = promocode
        self.price = price

        Log.updated(self, actor, now=now)

    def get_dict(self):
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
