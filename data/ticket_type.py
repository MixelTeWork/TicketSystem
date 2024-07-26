from datetime import datetime
from typing import Union
from sqlalchemy import JSON, Column, DefaultClause, ForeignKey, orm, Integer, String, Boolean
from sqlalchemy.orm import Session
from sqlalchemy_serializer import SerializerMixin

from data.get_datetime_now import get_datetime_now
from data.event import Event
from data.image import Image
from data.log import Actions, Log, Tables
from data.user import User
from .db_session import SqlAlchemyBase


class TicketType(SqlAlchemyBase, SerializerMixin):
    __tablename__ = "TicketType"

    id      = Column(Integer, primary_key=True, autoincrement=True, unique=True)
    deleted = Column(Boolean, DefaultClause("0"), nullable=False)
    eventId = Column(Integer, ForeignKey("Event.id"), nullable=False)
    name    = Column(String(64), nullable=False)
    number  = Column(Integer, nullable=False)
    imageId = Column(Integer, ForeignKey("Image.id"), nullable=True)
    pattern = Column(JSON, nullable=True)

    event = orm.relationship("Event", back_populates="ticket_types")
    image = orm.relationship("Image")

    def __repr__(self):
        return f"<TicketType> [{self.id}] {self.name}"

    @staticmethod
    def add(actor: User, event: Event, name: str, now: datetime):
        db_sess = Session.object_session(actor)

        ttype = TicketType(eventId=event.id, name=name, number=event.lastTypeNumber)
        db_sess.add(ttype)

        event.lastTypeNumber += 1

        log = Log(
            date=now,
            actionCode=Actions.added,
            userId=actor.id,
            userName=actor.name,
            tableName=Tables.TicketType,
            recordId=-1,
            changes=[
                ("name", None, ttype.name),
                ("eventId", None, ttype.eventId),
            ]
        )
        db_sess.add(log)

        return log, ttype

    @staticmethod
    def get(db_sess: Session, id: int, includeDeleted=False):
        ttype = db_sess.get(TicketType, id)
        if ttype is None or (not includeDeleted and ttype.deleted):
            return None
        return ttype

    @staticmethod
    def all_for_event(db_sess: Session, eventId: int):
        ttypes = db_sess.query(TicketType).filter(TicketType.deleted == False, TicketType.eventId == eventId).all()
        return ttypes

    def update_name(self, actor: User, name: str, now: Union[datetime, None] = None):
        db_sess = Session.object_session(actor)
        commit = False
        if now is None:
            commit = True
            now = get_datetime_now()

        db_sess.add(Log(
            date=now,
            actionCode=Actions.updated,
            userId=actor.id,
            userName=actor.name,
            tableName=Tables.TicketType,
            recordId=self.id,
            changes=[("name", self.name, name)]
        ))

        self.name = name
        if commit:
            db_sess.commit()

    def delete(self, actor: User, now: Union[datetime, None] = None):
        db_sess = Session.object_session(actor)
        commit = False
        if now is None:
            commit = True
            now = get_datetime_now()

        db_sess.add(Log(
            date=now,
            actionCode=Actions.deleted,
            userId=actor.id,
            userName=actor.name,
            tableName=Tables.TicketType,
            recordId=self.id,
            changes=[]
        ))

        self.deleted = True
        img: Image = self.image
        img.delete(actor, commit=commit)
        if commit:
            db_sess.commit()

    def get_dict(self):
        return self.to_dict(only=("id", "name", "imageId", "pattern"))
