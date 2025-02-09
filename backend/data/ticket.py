from random import randint

from sqlalchemy import Column, DefaultClause, DateTime, ForeignKey, orm, Integer, String, Boolean
from sqlalchemy.orm import Session

from bfs import SqlAlchemyBase, ObjMixin, Log, get_datetime_now
from data._tables import Tables
from data.event import Event
from data.ticket_type import TicketType
from data.user import User


class Ticket(SqlAlchemyBase, ObjMixin):
    __tablename__ = Tables.Ticket

    createdDate = Column(DateTime, nullable=False)
    createdById = Column(Integer, ForeignKey("User.id"), nullable=False)
    eventId = Column(Integer, ForeignKey("Event.id"), nullable=False)
    typeId = Column(Integer, ForeignKey("TicketType.id"), nullable=False)
    code = Column(String(32), unique=True, nullable=False)
    scanned = Column(Boolean, DefaultClause("0"), nullable=False)
    updatedDate = Column(DateTime)
    updatedById = Column(Integer, ForeignKey("User.id"))
    scannedDate = Column(DateTime)
    scannedById = Column(Integer, ForeignKey("User.id"))
    personName = Column(String(256))
    personLink = Column(String(256))
    promocode = Column(String(64))
    authOnPltf = Column(Boolean, DefaultClause("0"), nullable=False)

    createdBy = orm.relationship("User", foreign_keys=[createdById])
    event = orm.relationship("Event", back_populates="tickets")
    type = orm.relationship("TicketType")
    scannedBy = orm.relationship("User", foreign_keys=[scannedById])

    def __repr__(self):
        return f"<Ticket> [{self.id}] {self.code}"

    @staticmethod
    def new(creator: User, ttype: TicketType, event: Event, personName: str, personLink: str, promocode: str, code: str):
        db_sess = Session.object_session(creator)
        now = get_datetime_now()
        ticket = Ticket(createdDate=now, createdById=creator.id, eventId=event.id, typeId=ttype.id,
                        personName=personName, personLink=personLink, promocode=promocode)

        if code:
            ticket_with_code = Ticket.get_by_code(db_sess, code, includeDeleted=True)
            if ticket_with_code is not None:
                return None, f"Ticket with 'code={code}' already exist"
            ticket.code = code
        else:
            ticket.set_code(event.date, event.lastTicketNumber, ttype.number)
            event.lastTicketNumber += 1
        db_sess.add(ticket)

        Log.added(ticket, creator, Tables.Ticket, [
            ("createdDate", ticket.createdDate.isoformat()),
            ("createdById", ticket.createdById),
            ("eventId", ticket.eventId),
            ("typeId", ticket.typeId),
            ("code", ticket.code),
            ("personName", ticket.personName),
            ("personLink", ticket.personLink),
            ("promocode", ticket.promocode),
        ], now=now)
        return ticket, None

    @staticmethod
    def get_by_code(db_sess: Session, code: str, includeDeleted=False):
        return Ticket.query(db_sess, includeDeleted).filter(Ticket.code == code).first()

    @staticmethod
    def all_for_event(db_sess: Session, eventId: int):
        return Ticket.query(db_sess).filter(Ticket.eventId == eventId).all()

    def set_code(self, eventDate, last_ticket_number, type_number):
        date = str(eventDate.year)[-1] + f"{eventDate.month:02d}{eventDate.day:02d}"
        self.code = f"{self.eventId:03d}-{date}-{randint(0, 99):02d}-{type_number:02d}-{last_ticket_number + 1:04d}"

    def update(self, actor: User, typeId: int, personName: str, personLink: str, promocode: str):
        now = get_datetime_now()

        updatedDate_old = self.updatedDate
        updatedById_old = self.updatedById
        typeId_old = self.typeId
        personName_old = self.personName
        personLink_old = self.personLink
        promocode_old = self.promocode

        self.updatedDate = now
        self.updatedById = actor.id
        self.typeId = typeId
        self.personName = personName
        self.personLink = personLink
        self.promocode = promocode

        Log.updated(self, actor, Tables.Ticket, list(filter(lambda v: v[1] != v[2], [
            ("updatedDate", updatedDate_old.isoformat() if updatedDate_old is not None else None, now.isoformat()),
            ("updatedById", updatedById_old, actor.id),
            ("typeId", typeId_old, typeId),
            ("personName", personName_old, personName),
            ("personLink", personLink_old, personLink),
            ("promocode", promocode_old, promocode),
        ])), now=now)

    def get_dict(self):
        res = self.to_dict(only=("id", "createdDate", "eventId", "typeId", "code", "scanned", "scannedById",
                           "scannedDate", "personName", "personLink", "promocode", "authOnPltf"))
        res["type"] = self.type.name
        if self.type.deleted:
            res["type"] = "<Удалён>" + res["type"]
        res["scannedBy"] = self.scannedBy.name if self.scannedBy is not None else None
        return res
