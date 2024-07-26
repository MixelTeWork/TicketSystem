from datetime import datetime
from sqlalchemy import Column, DateTime, DefaultClause, orm, Integer, String, Boolean
from sqlalchemy.orm import Session
from sqlalchemy_serializer import SerializerMixin

from data.get_datetime_now import get_datetime_now
from data.log import Actions, Log, Tables
from data.permission_access import PermissionAccess
from data.user import User
from .db_session import SqlAlchemyBase


class Event(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "Event"

    id               = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    deleted          = Column(Boolean, DefaultClause("0"), nullable=False)
    name             = Column(String(64), nullable=False)
    date             = Column(DateTime, nullable=False)
    active           = Column(Boolean, DefaultClause("1"), nullable=False)
    lastTicketNumber = Column(Integer, DefaultClause("0"), nullable=False)
    lastTypeNumber   = Column(Integer, DefaultClause("0"), nullable=False)

    tickets = orm.relationship("Ticket", back_populates="event")
    ticket_types = orm.relationship("TicketType", back_populates="event")

    def __repr__(self):
        return f"<Event> [{self.id}] {self.name}"

    @staticmethod
    def new(db_sess: Session, creator: User, name: str, date: datetime):
        event = Event(name=name, date=date)
        db_sess.add(event)

        log = Log(
            date=get_datetime_now(),
            actionCode=Actions.added,
            userId=creator.id,
            userName=creator.name,
            tableName=Tables.Event,
            recordId=-1,
            changes=[
                ("name", None, event.name),
                ("date", None, event.date.isoformat()),
            ]
        )
        db_sess.add(log)
        db_sess.commit()
        log.recordId = event.id
        creator.add_access(event.id, actor=creator)
        db_sess.commit()
        return event

    @staticmethod
    def get(db_sess: Session, id: int, includeDeleted=False):
        event = db_sess.get(Event, id)
        if event is None or (not includeDeleted and event.deleted):
            return None
        return event

    @staticmethod
    def all_for_user(db_sess: Session, user: User):
        return db_sess \
            .query(Event) \
            .filter(Event.deleted == False, User.access.any((PermissionAccess.eventId == Event.id) & (PermissionAccess.userId == user.id))) \
            .all()

    def delete(self, actor: User, commit=True):
        db_sess = Session.object_session(self)

        self.deleted = True

        db_sess.add(Log(
            date=get_datetime_now(),
            actionCode=Actions.deleted,
            userId=actor.id,
            userName=actor.name,
            tableName=Tables.Event,
            recordId=self.id,
            changes=[]
        ))
        if commit:
            db_sess.commit()

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
