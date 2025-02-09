from datetime import datetime

from sqlalchemy import Column, DateTime, DefaultClause, orm, Integer, String, Boolean
from sqlalchemy.orm import Session

from bfs import SqlAlchemyBase, ObjMixin, Log
from data._tables import Tables
from data.permission_access import PermissionAccess
from data.user import User


class Event(SqlAlchemyBase, ObjMixin):
    __tablename__ = Tables.Event

    name = Column(String(64), nullable=False)
    date = Column(DateTime, nullable=False)
    active = Column(Boolean, DefaultClause("1"), nullable=False)
    lastTicketNumber = Column(Integer, DefaultClause("0"), nullable=False)
    lastTypeNumber = Column(Integer, DefaultClause("0"), nullable=False)

    tickets = orm.relationship("Ticket", back_populates="event")
    ticket_types = orm.relationship("TicketType", back_populates="event")

    def __repr__(self):
        return f"<Event> [{self.id}] {self.name}"

    @staticmethod
    def new(creator: User, name: str, date: datetime):
        db_sess = Session.object_session(creator)
        event = Event(name=name, date=date)
        db_sess.add(event)

        Log.added(event, creator, [
            ("name", event.name),
            ("date", event.date.isoformat()),
        ])
        creator.add_access(event.id, actor=creator)
        return event

    @staticmethod
    def all_for_user(user: User):
        db_sess = Session.object_session(user)
        return Event.query(db_sess) \
            .filter(User.access.any((PermissionAccess.eventId == Event.id) & (PermissionAccess.userId == user.id))) \
            .all()

    def get_dict(self):
        return self.to_dict(only=("id", "name", "date"))

    def get_dict_full(self):
        db_sess = Session.object_session(self)
        access = User.all_event_access(db_sess, self.id)
        return {
            "id": self.id,
            "deleted": self.deleted,
            "name": self.name,
            "date": self.date,
            "active": self.active,
            "access": list(map(lambda v: v.get_dict(), access)),
        }
