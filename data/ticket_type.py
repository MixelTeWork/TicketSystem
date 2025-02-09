from datetime import datetime

from sqlalchemy import JSON, Column, ForeignKey, orm, Integer, String
from sqlalchemy.orm import Session

from bfs import SqlAlchemyBase, ObjMixin, Log
from data._tables import Tables
from data.event import Event
from data.user import User
from data.img import Image


class TicketType(SqlAlchemyBase, ObjMixin):
    __tablename__ = Tables.TicketType

    eventId = Column(Integer, ForeignKey("Event.id"), nullable=False)
    name = Column(String(64), nullable=False)
    number = Column(Integer, nullable=False)
    imageId = Column(Integer, ForeignKey("Image.id"), nullable=True)
    pattern = Column(JSON, nullable=True)

    event = orm.relationship("Event", back_populates="ticket_types")
    image = orm.relationship("data.img.Image")

    def __repr__(self):
        return f"<TicketType> [{self.id}] {self.name}"

    @staticmethod
    def add(actor: User, event: Event, name: str, now: datetime):
        db_sess = Session.object_session(actor)

        ttype = TicketType(eventId=event.id, name=name, number=event.lastTypeNumber)
        db_sess.add(ttype)

        event.lastTypeNumber += 1

        log = Log.added(ttype, actor, [
            ("name", ttype.name),
            ("eventId", ttype.eventId),
        ], now=now, commit=False)

        return ttype, log

    @staticmethod
    def all_for_event(db_sess: Session, eventId: int):
        return TicketType.query(db_sess).filter(TicketType.eventId == eventId).all()

    def update_name(self, actor: User, name: str, commit=True, now: datetime = None):
        oldname = self.name
        self.name = name
        Log.updated(self, actor, [("name", oldname, name)], now=now, commit=commit)

    def delete(self, actor: User, commit=True, now: datetime = None):
        super().delete(actor, commit=commit, now=now)

        img: Image = self.image
        if img is not None:
            img.delete(actor, commit=commit)

    def get_dict(self):
        return self.to_dict(only=("id", "name", "imageId", "pattern"))
