from sqlalchemy import Column, DateTime, ForeignKey, orm, Integer, String, JSON
from sqlalchemy_serializer import SerializerMixin
from .db_session import SqlAlchemyBase


class Log(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Log"
    __table_args__ = {
        "mysql_default_charset": "utf16",
        "mysql_collate": "utf16_icelandic_ci",
    }

    id         = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    date       = Column(DateTime, nullable=False)
    actionCode = Column(String(16), nullable=False)
    userId     = Column(Integer, ForeignKey("User.id"), nullable=False)
    userName   = Column(String(64), nullable=False)
    tableName  = Column(String(16), nullable=False)
    recordId   = Column(Integer, nullable=False)
    changes    = Column(JSON, nullable=False)

    user = orm.relationship("User")

    def __repr__(self):
        return f"<Log> [{self.id}] {self.date} {self.actionCode}"

    # def get_dict(self):
    #     return self.to_dict(only=("name"))


class Actions:
    added = "added"
    updated = "updated"
    scanned = "scanned"
    deleted = "deleted"
    restored = "restored"


class Tables:
    User = "User"
    Role = "Role"
    Event = "Event"
    Ticket = "Ticket"
    TicketType = "TicketType"
