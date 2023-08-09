from random import randint
from sqlalchemy import Column, DateTime, ForeignKey, orm, Integer, String, Boolean
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase


class Ticket(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Ticket"

    id          = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    deleted     = Column(Boolean, default=False, nullable=False)
    createdDate = Column(DateTime, nullable=False)
    createdById = Column(Integer, ForeignKey("User.id"), nullable=False)
    eventId     = Column(Integer, ForeignKey("Event.id"), nullable=False)
    typeId      = Column(Integer, ForeignKey("TicketType.id"), nullable=False)
    code        = Column(String, nullable=False)
    scanned     = Column(Boolean, default=False, nullable=False)
    scannedDate = Column(DateTime)
    scannedById = Column(Integer, ForeignKey("User.id"))
    personName  = Column(String)
    personLink  = Column(String)
    promocode   = Column(String)

    createdBy = orm.relationship("User", foreign_keys=[createdById])
    event = orm.relationship("Event", back_populates="tickets")
    type = orm.relationship("TicketType")
    scannedBy = orm.relationship("User", foreign_keys=[scannedById])

    def __repr__(self):
        return f"<Ticket> [{self.id}] {self.code}"

    def set_code(self, eventDate, last_ticket_number):
        date = str(eventDate.year)[-1] + f"{eventDate.month:02d}{eventDate.day:02d}"
        self.code = f"{self.eventId:03d}-{date}-{randint(0, 99):02d}-{last_ticket_number + 1:04d}"

    def get_creation_changes(self):
        return [
            ("createdDate", None, self.createdDate),
            ("createdById", None, self.createdById),
            ("eventId", None, self.eventId),
            ("typeId", None, self.typeId),
            ("code", None, self.code),
            ("scanned", None, self.scanned),
            ("scannedDate", None, self.scannedDate),
            ("scannedById", None, self.scannedById),
            ("personName", None, self.personName),
            ("personLink", None, self.personLink),
            ("promocode", None, self.promocode),
        ]

    def get_dict(self):
        res = self.to_dict(only=("id", "eventId", "code", "scanned", "scannedById",
                           "scannedDate", "personName", "personLink", "promocode"))
        res["type"] = self.type.name
        res["scannedBy"] = self.scannedBy.name
        return res
