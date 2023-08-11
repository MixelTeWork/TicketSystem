from sqlalchemy import Column, DefaultClause, ForeignKey, orm, Integer, String, Boolean
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase


class TicketType(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "TicketType"

    id      = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    deleted = Column(Boolean, DefaultClause("0"), nullable=False)
    eventId = Column(Integer, ForeignKey("Event.id"), nullable=False)
    name    = Column(String, nullable=False)
    number  = Column(Integer, nullable=False)

    event = orm.relationship("Event", back_populates="ticket_types")

    def __repr__(self):
        return f"<TicketType> [{self.id}] {self.name}"

    def get_creation_changes(self):
        return [
            ("name", None, self.name),
            ("eventId", None, self.eventId),
        ]

    def get_dict(self):
        return self.to_dict(only=("id", "name"))
