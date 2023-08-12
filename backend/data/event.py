from sqlalchemy import Column, DateTime, DefaultClause, orm, Integer, String, Boolean
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase


class Event(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Event"
    __table_args__ = {
        "mysql_default_charset": "utf16",
        "mysql_collate": "utf16_icelandic_ci",
    }

    id               = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    deleted          = Column(Boolean, DefaultClause("0"), nullable=False)
    name             = Column(String, nullable=False)
    date             = Column(DateTime, nullable=False)
    active           = Column(Boolean, DefaultClause("1"), nullable=False)
    lastTicketNumber = Column(Integer, DefaultClause("0"), nullable=False)
    lastTypeNumber   = Column(Integer, DefaultClause("0"), nullable=False)

    tickets = orm.relationship("Ticket", back_populates="event")
    ticket_types = orm.relationship("TicketType", back_populates="event")

    def __repr__(self):
        return f"<Event> [{self.id}] {self.name}"

    def get_creation_changes(self):
        return [
            ("name", None, self.name),
            ("date", None, self.date.isoformat()),
        ]

    def get_dict(self):
        return self.to_dict(only=("id", "name", "date"))
