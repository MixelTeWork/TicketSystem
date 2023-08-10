from sqlalchemy import Column, DateTime, orm, Integer, String, Boolean
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase


class Event(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Event"

    id               = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    deleted          = Column(Boolean, default=False, nullable=False)
    name             = Column(String, nullable=False)
    date             = Column(DateTime, nullable=False)
    active           = Column(Boolean, default=True, nullable=False)
    lastTicketNumber = Column(Integer, default=0, nullable=False)

    tickets = orm.relationship("Ticket", back_populates="event")
    ticket_types = orm.relationship("TicketType", back_populates="event")

    def __repr__(self):
        return f"<Event> [{self.id}] {self.name}"

    def get_creation_changes(self):
        return [
            ("name", None, self.name),
            ("date", None, self.date),
            ("lastTicketNumber", None, self.lastTicketNumber),
        ]

    def get_dict(self):
        return self.to_dict(only=("id", "name", "date"))
