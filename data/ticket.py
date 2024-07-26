from random import randint
from sqlalchemy import Column, DefaultClause, DateTime, ForeignKey, orm, Integer, String, Boolean
from sqlalchemy.orm import Session
from sqlalchemy_serializer import SerializerMixin

from data.event import Event
from data.get_datetime_now import get_datetime_now
from data.log import Actions, Log, Tables
from data.ticket_type import TicketType
from data.user import User
from .db_session import SqlAlchemyBase


class Ticket(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Ticket"

    id          = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    deleted     = Column(Boolean, DefaultClause("0"), nullable=False)
    createdDate = Column(DateTime, nullable=False)
    createdById = Column(Integer, ForeignKey("User.id"), nullable=False)
    eventId     = Column(Integer, ForeignKey("Event.id"), nullable=False)
    typeId      = Column(Integer, ForeignKey("TicketType.id"), nullable=False)
    code        = Column(String(32), unique=True, nullable=False)
    scanned     = Column(Boolean, DefaultClause("0"), nullable=False)
    updatedDate = Column(DateTime)
    updatedById = Column(Integer, ForeignKey("User.id"))
    scannedDate = Column(DateTime)
    scannedById = Column(Integer, ForeignKey("User.id"))
    personName  = Column(String(256))
    personLink  = Column(String(256))
    promocode   = Column(String(64))
    authOnPltf  = Column(Boolean, DefaultClause("0"), nullable=False)

    createdBy = orm.relationship("User", foreign_keys=[createdById])
    event = orm.relationship("Event", back_populates="tickets")
    type = orm.relationship("TicketType")
    scannedBy = orm.relationship("User", foreign_keys=[scannedById])

    def __repr__(self):
        return f"<Ticket> [{self.id}] {self.code}"

    @staticmethod
    def new(db_sess: Session, creator: User, ttype: TicketType, event: Event, personName: str, personLink: str, promocode: str, code: str):
        now = get_datetime_now()
        ticket = Ticket(createdDate=now, createdById=creator.id, eventId=event.id, typeId=ttype.id,
                        personName=personName, personLink=personLink, promocode=promocode)

        if code:
            ticket_with_code = Ticket.get_by_code(db_sess, code, includeDeleted=True)
            if ticket_with_code is not None:
                return None, f"Ticket with 'code={code}' is already exist"
            ticket.code = code
        else:
            ticket.set_code(event.date, event.lastTicketNumber, ttype.number)
            event.lastTicketNumber += 1
        db_sess.add(ticket)

        log = Log(
            date=now,
            actionCode=Actions.added,
            userId=creator.id,
            userName=creator.name,
            tableName=Tables.Ticket,
            recordId=-1,
            changes=[
                ("createdDate", None, ticket.createdDate.isoformat()),
                ("createdById", None, ticket.createdById),
                ("eventId", None, ticket.eventId),
                ("typeId", None, ticket.typeId),
                ("code", None, ticket.code),
                ("personName", None, ticket.personName),
                ("personLink", None, ticket.personLink),
                ("promocode", None, ticket.promocode),
            ]
        )
        db_sess.add(log)
        db_sess.commit()
        log.recordId = ticket.id
        db_sess.commit()
        return ticket, None

    @staticmethod
    def get(db_sess: Session, id: int, includeDeleted=False):
        ticket = db_sess.get(Ticket, id)
        if ticket is None or (not includeDeleted and ticket.deleted):
            return None
        return ticket

    @staticmethod
    def get_by_code(db_sess: Session, code: str, includeDeleted=False):
        ticket = db_sess.query(Ticket).filter(Ticket.code == code)
        if not includeDeleted:
            ticket = ticket.filter(Ticket.deleted == False)
        return ticket.first()

    @staticmethod
    def all_for_event(db_sess: Session, eventId: int):
        tickets = db_sess.query(Ticket).filter(Ticket.deleted == False, Ticket.eventId == eventId).all()
        return tickets

    def set_code(self, eventDate, last_ticket_number, type_number):
        date = str(eventDate.year)[-1] + f"{eventDate.month:02d}{eventDate.day:02d}"
        self.code = f"{self.eventId:03d}-{date}-{randint(0, 99):02d}-{type_number:02d}-{last_ticket_number + 1:04d}"

    def update(self, actor: User, typeId: int, personName: str, personLink: str, promocode: str):
        db_sess = Session.object_session(self)
        now = get_datetime_now()
        db_sess.add(Log(
            date=now,
            actionCode=Actions.updated,
            userId=actor.id,
            userName=actor.name,
            tableName=Tables.Ticket,
            recordId=self.id,
            changes=list(filter(lambda v: v[1] != v[2], [
                ("updatedDate", self.updatedDate.isoformat() if self.updatedDate is not None else None, now.isoformat()),
                ("updatedById", self.updatedById, actor.id),
                ("typeId", self.typeId, typeId),
                ("personName", self.personName, personName),
                ("personLink", self.personLink, personLink),
                ("promocode", self.promocode, promocode),
            ]))
        ))
        self.updatedDate = now
        self.updatedById = actor.id
        self.typeId = typeId
        self.personName = personName
        self.personLink = personLink
        self.promocode = promocode

        db_sess.commit()

    def delete(self, actor: User):
        db_sess = Session.object_session(self)
        self.deleted = True

        db_sess.add(Log(
            date=get_datetime_now(),
            actionCode=Actions.deleted,
            userId=actor.id,
            userName=actor.name,
            tableName=Tables.Ticket,
            recordId=self.id,
            changes=[]
        ))
        db_sess.commit()

    def get_dict(self):
        res = self.to_dict(only=("id", "createdDate", "eventId", "typeId", "code", "scanned", "scannedById",
                           "scannedDate", "personName", "personLink", "promocode", "authOnPltf"))
        res["type"] = self.type.name
        if self.type.deleted:
            res["type"] = "<Удалён>" + res["type"]
        res["scannedBy"] = self.scannedBy.name if self.scannedBy is not None else None
        return res
